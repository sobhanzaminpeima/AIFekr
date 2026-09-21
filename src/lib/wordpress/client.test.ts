import { describe, it, expect, beforeEach, vi } from "vitest";

const { safeFetch } = vi.hoisted(() => ({ safeFetch: vi.fn() }));
vi.mock("@/lib/net/safeUrl", () => ({ safeFetch, UnsafeUrlError: class extends Error {} }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/crypto/secretBox", () => ({ decryptSecret: (s: string) => s }));

import { testWordPress, createPost, applySeoToUrl, findContentByUrl, type WpConn } from "./client";

const conn: WpConn = { siteUrl: "https://blog.test", username: "editor", appPassword: "abcd efgh" };
const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

/** Routes a fake WordPress by "METHOD path" so each test only describes what it cares about. */
function fakeWp(routes: Record<string, unknown | ((body: unknown) => unknown)>) {
  safeFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname.replace("/wp-json", "") + new URL(url).search;
    const key = `${(init?.method || "GET").toUpperCase()} ${path}`;
    // longest matching route wins; the bare index route "GET /" must match exactly
    const hit = Object.entries(routes).filter(([k]) => key === k || (k !== "GET /" && key.startsWith(k))).sort((a, b) => b[0].length - a[0].length)[0];
    if (!hit) return json({ code: "rest_no_route" }, 404);
    const v = hit[1];
    return typeof v === "function" ? (v as (b: unknown) => unknown)(init?.body ? JSON.parse(String(init.body)) : undefined) : v;
  });
}

beforeEach(() => { safeFetch.mockReset(); }); // braces: a returned mock would be run by vitest as a cleanup callback

describe("testWordPress", () => {
  it("reports the site, user, permissions and the SEO plugin", async () => {
    fakeWp({
      "GET /": json({ name: "My Blog", namespaces: ["wp/v2", "yoast/v1"] }),
      "GET /wp/v2/users/me": json({ name: "Editor", capabilities: { publish_posts: true, edit_posts: true } }),
    });
    expect(await testWordPress(conn)).toEqual({ ok: true, siteName: "My Blog", seoPlugin: "yoast", user: "Editor", canPublish: true });
  });
  it("tells apart a wrong password, a non-WordPress site and an unreachable one", async () => {
    fakeWp({ "GET /": json({ name: "x", namespaces: ["wp/v2"] }), "GET /wp/v2/users/me": json({ code: "rest_forbidden" }, 401) });
    expect(await testWordPress(conn)).toEqual({ ok: false, reason: "auth_failed" });
    fakeWp({ "GET /": json({ name: "x", namespaces: ["something/else"] }) });
    expect(await testWordPress(conn)).toEqual({ ok: false, reason: "not_wordpress" });
    safeFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await testWordPress(conn)).toEqual({ ok: false, reason: "unreachable" });
  });
  it("refuses an account that cannot write posts", async () => {
    fakeWp({ "GET /": json({ namespaces: ["wp/v2"] }), "GET /wp/v2/users/me": json({ name: "Sub", capabilities: { read: true } }) });
    expect(await testWordPress(conn)).toEqual({ ok: false, reason: "no_permission" });
  });
});

describe("createPost", () => {
  const input = { title: "T", contentHtml: "<p>x</p>", slug: "t", excerpt: "e", status: "draft" as const, seo: { title: "SEO T", description: "SEO D", focusKeyword: "kw" } };

  it("sends the SEO fields with the post and confirms what WordPress accepted", async () => {
    let sent: { meta?: Record<string, string>; status?: string } = {};
    fakeWp({
      "GET /": json({ namespaces: ["wp/v2", "yoast/v1"] }),
      "POST /wp/v2/posts": (b: unknown) => { sent = b as typeof sent; return json({ id: 7, link: "https://blog.test/?p=7", status: "draft", meta: { _yoast_wpseo_title: "SEO T", _yoast_wpseo_metadesc: "SEO D" } }); },
    });
    const res = await createPost(conn, input);
    expect(res).toMatchObject({ ok: true, id: 7, status: "draft", editUrl: "https://blog.test/wp-admin/post.php?post=7&action=edit" });
    expect(sent.status).toBe("draft");
    expect(sent.meta).toMatchObject({ _yoast_wpseo_title: "SEO T", _yoast_wpseo_focuskw: "kw" });
    if (res.ok) expect(res.seo).toMatchObject({ _yoast_wpseo_title: "confirmed", _yoast_wpseo_metadesc: "confirmed", _yoast_wpseo_focuskw: "not_confirmed" }); // focus kw was dropped by the site
  });
  it("still creates the post on a site without an SEO plugin, and says no SEO field was applied", async () => {
    fakeWp({ "GET /": json({ namespaces: ["wp/v2"] }), "POST /wp/v2/posts": json({ id: 9, link: "https://blog.test/t", status: "draft", meta: [] }) });
    const res = await createPost(conn, input);
    expect(res).toMatchObject({ ok: true, id: 9, seoPlugin: null, seo: {} });
  });
  it("surfaces a WordPress rejection", async () => {
    fakeWp({ "GET /": json({ namespaces: ["wp/v2"] }), "POST /wp/v2/posts": json({ code: "rest_cannot_create" }, 403) });
    const res = await createPost(conn, input);
    expect(res.ok).toBe(false);
  });
});

describe("applySeoToUrl", () => {
  it("does not touch the visible post title and reports honestly when the plugin dropped a field", async () => {
    let sent: Record<string, unknown> = {};
    fakeWp({
      "GET /": json({ namespaces: ["wp/v2", "rankmath/v1"] }),
      "GET /wp/v2/posts?slug=my-post": json([{ id: 5, link: "https://blog.test/my-post/" }]),
      "POST /wp/v2/posts/5": (b: unknown) => { sent = b as typeof sent; return json({ meta: { rank_math_title: "New SEO title" } }); },
    });
    const res = await applySeoToUrl(conn, "https://blog.test/my-post/", { title: "New SEO title", description: "New description" });
    expect(Object.keys(sent)).toEqual(["meta"]); // no `title`: the headline stays as it is
    expect(res).toMatchObject({ ok: true, seoPlugin: "rankmath", fields: { rank_math_title: "confirmed", rank_math_description: "not_confirmed" } });
  });
  it("writes nothing when there is no supported SEO plugin", async () => {
    fakeWp({ "GET /": json({ namespaces: ["wp/v2"] }) });
    expect(await applySeoToUrl(conn, "https://blog.test/p/", { title: "x" })).toEqual({ ok: false, reason: "no_plugin" });
    expect(safeFetch.mock.calls.every(([, i]) => (i?.method || "GET") === "GET")).toBe(true);
  });
  it("reports a page it cannot find", async () => {
    fakeWp({ "GET /": json({ namespaces: ["wp/v2", "yoast/v1"] }), "GET /wp/v2/posts?slug": json([]), "GET /wp/v2/pages?slug": json([]) });
    expect(await applySeoToUrl(conn, "https://blog.test/missing/", { title: "x" })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("findContentByUrl", () => {
  it("resolves the static front page for the site root", async () => {
    fakeWp({ "GET /wp/v2/settings": json({ page_on_front: 12 }), "GET /wp/v2/pages/12": json({ link: "https://blog.test/" }) });
    expect(await findContentByUrl(conn, "https://blog.test/")).toEqual({ id: 12, type: "pages", link: "https://blog.test/" });
  });
  it("returns null when the root is not a static page", async () => {
    fakeWp({ "GET /wp/v2/settings": json({ page_on_front: 0 }) });
    expect(await findContentByUrl(conn, "https://blog.test/")).toBeNull();
  });
});
