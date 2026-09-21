import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secretBox";
import { safeFetch } from "@/lib/net/safeUrl";
import { confirmMeta, detectSeoPlugin, editUrlFor, seoMetaFor, slugFromUrl, wpBase, type FieldConfirmation, type SeoFields, type SeoPlugin } from "@/lib/wordpress/core";

export interface WpConn { siteUrl: string; username: string; appPassword: string }

/** The user's saved WordPress connection, with the application password decrypted; null if incomplete. */
export async function loadWpConn(userId: string): Promise<WpConn | null> {
  const c = await prisma.seoConnection.findUnique({ where: { userId } });
  if (!c || c.platform !== "wordpress" || !c.siteUrl || !c.wpUsername || !c.wpAppPassword) return null;
  return { siteUrl: c.siteUrl, username: c.wpUsername, appPassword: decryptSecret(c.wpAppPassword) };
}

async function wp(c: WpConn, path: string, init: RequestInit = {}): Promise<Response> {
  const auth = "Basic " + Buffer.from(`${c.username}:${c.appPassword}`).toString("base64");
  return safeFetch(`${wpBase(c.siteUrl)}/wp-json${path}`, {
    ...init,
    headers: { Authorization: auth, "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
}

export type WpTest =
  | { ok: true; siteName: string; seoPlugin: SeoPlugin; user: string; canPublish: boolean }
  | { ok: false; reason: "unreachable" | "not_wordpress" | "auth_failed" | "no_permission" };

/** Can we reach the site's REST API, does the application password work, and may it publish? */
export async function testWordPress(c: WpConn): Promise<WpTest> {
  let index: { name?: string; namespaces?: string[] };
  try {
    const r = await wp(c, "/");
    if (!r.ok) return { ok: false, reason: r.status === 404 ? "not_wordpress" : "unreachable" };
    index = await r.json();
  } catch { return { ok: false, reason: "unreachable" }; }
  if (!Array.isArray(index.namespaces) || !index.namespaces.includes("wp/v2")) return { ok: false, reason: "not_wordpress" };

  try {
    const me = await wp(c, "/wp/v2/users/me?context=edit");
    if (me.status === 401 || me.status === 403) return { ok: false, reason: "auth_failed" };
    if (!me.ok) return { ok: false, reason: "unreachable" };
    const u = (await me.json()) as { name?: string; capabilities?: Record<string, boolean> };
    const canPublish = !!(u.capabilities?.publish_posts || u.capabilities?.edit_posts);
    if (!canPublish) return { ok: false, reason: "no_permission" };
    return { ok: true, siteName: index.name || wpBase(c.siteUrl), seoPlugin: detectSeoPlugin(index.namespaces), user: u.name || c.username, canPublish: !!u.capabilities?.publish_posts };
  } catch { return { ok: false, reason: "unreachable" }; }
}

async function pluginOf(c: WpConn): Promise<SeoPlugin> {
  try {
    const r = await wp(c, "/");
    if (!r.ok) return null;
    return detectSeoPlugin(((await r.json()) as { namespaces?: string[] }).namespaces ?? []);
  } catch { return null; }
}

export interface CreatePostInput { title: string; contentHtml: string; slug: string; excerpt: string; status: "draft" | "publish"; seo: SeoFields }
export type CreatePostResult =
  | { ok: true; id: number; link: string | null; editUrl: string; status: "draft" | "publish"; seoPlugin: SeoPlugin; seo: Record<string, FieldConfirmation> }
  | { ok: false; error: string };

/**
 * Creates a post and sets its SEO plugin fields in the same request. The post is
 * created either way; `seo` says which SEO fields WordPress actually accepted, so
 * the caller can tell the user instead of assuming.
 */
export async function createPost(c: WpConn, input: CreatePostInput): Promise<CreatePostResult> {
  const plugin = await pluginOf(c);
  const meta = seoMetaFor(plugin, input.seo);
  try {
    const r = await wp(c, "/wp/v2/posts?context=edit", {
      method: "POST",
      body: JSON.stringify({ title: input.title, content: input.contentHtml, slug: input.slug, excerpt: input.excerpt, status: input.status, ...(Object.keys(meta).length ? { meta } : {}) }),
    });
    if (!r.ok) return { ok: false, error: `WordPress error ${r.status}: ${(await r.text()).slice(0, 300)}` };
    const post = (await r.json()) as { id: number; link?: string; status?: string; meta?: unknown };
    return {
      ok: true, id: post.id, link: post.link ?? null, editUrl: editUrlFor(c.siteUrl, post.id), status: post.status === "publish" ? "publish" : "draft",
      seoPlugin: plugin, seo: confirmMeta(meta, post.meta),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type FoundContent = { id: number; type: "posts" | "pages"; link: string };

/** Finds the post/page a URL belongs to (by slug, or the static front page for the site root). */
export async function findContentByUrl(c: WpConn, url: string): Promise<FoundContent | null> {
  const slug = slugFromUrl(url);
  try {
    if (!slug) {
      const s = await wp(c, "/wp/v2/settings");
      if (!s.ok) return null;
      const front = ((await s.json()) as { page_on_front?: number }).page_on_front;
      if (!front) return null;
      const p = await wp(c, `/wp/v2/pages/${front}?context=edit`);
      return p.ok ? { id: front, type: "pages", link: ((await p.json()) as { link?: string }).link ?? url } : null;
    }
    for (const type of ["posts", "pages"] as const) {
      const r = await wp(c, `/wp/v2/${type}?slug=${encodeURIComponent(slug)}&status=any&context=edit`);
      if (!r.ok) continue;
      const list = (await r.json()) as { id: number; link?: string }[];
      if (Array.isArray(list) && list.length) return { id: list[0].id, type, link: list[0].link ?? url };
    }
  } catch { /* fall through */ }
  return null;
}

export type ApplySeoResult =
  | { ok: true; seoPlugin: SeoPlugin; fields: Record<string, FieldConfirmation>; editUrl: string }
  | { ok: false; reason: "not_found" | "no_plugin" | "error"; message?: string };

/**
 * Writes SEO title / description / focus keyword to a page's SEO plugin fields (NOT the
 * visible post title) and reads the result back. With no supported SEO plugin nothing is
 * written and `no_plugin` is returned, so the UI can hand the user the text to paste.
 */
export async function applySeoToUrl(c: WpConn, url: string, fields: SeoFields): Promise<ApplySeoResult> {
  const plugin = await pluginOf(c);
  if (!plugin) return { ok: false, reason: "no_plugin" };
  const found = await findContentByUrl(c, url);
  if (!found) return { ok: false, reason: "not_found" };

  const meta = seoMetaFor(plugin, fields);
  if (!Object.keys(meta).length) return { ok: false, reason: "error", message: "nothing to apply" };
  try {
    const r = await wp(c, `/wp/v2/${found.type}/${found.id}?context=edit`, { method: "POST", body: JSON.stringify({ meta }) });
    if (!r.ok) return { ok: false, reason: "error", message: `WordPress error ${r.status}: ${(await r.text()).slice(0, 200)}` };
    const updated = (await r.json()) as { meta?: unknown };
    return { ok: true, seoPlugin: plugin, fields: confirmMeta(meta, updated.meta), editUrl: editUrlFor(c.siteUrl, found.id, found.type) };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
