import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";

/**
 * Reads a JSON response, or explains in the reader's language why it could not.
 *
 * `await res.json()` on a non-JSON body throws
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`, and that string
 * reached users verbatim. It happens whenever something between the browser and
 * the route answers with HTML instead: nginx returning its 502 page while the
 * app restarts during a deploy, a proxy error page, a gateway timeout. The
 * request did not "return invalid JSON" — the server was not there. The user
 * should be told that, and told to try again.
 */
// The generic defaults to `any` for the same reason `Response.json()` does:
// call sites read shapes the server defines, and forcing each one to restate
// that shape here would be busywork, not safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseJsonResponse<T = any>(res: Response, lang: Lang): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // 5xx from a gateway means the app itself did not answer.
    if (res.status >= 500) {
      throw new Error(tri(lang,
        "سرور در دسترس نبود. چند لحظه بعد دوباره تلاش کنید.",
        "The server was unavailable. Please try again in a moment.",
        "Der Server war nicht erreichbar. Bitte versuchen Sie es gleich erneut."));
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(tri(lang,
        "نشست شما منقضی شده است. دوباره وارد شوید.",
        "Your session has expired. Please sign in again.",
        "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."));
    }
    throw new Error(tri(lang,
      `پاسخ غیرمنتظره از سرور (کد ${res.status}).`,
      `Unexpected response from the server (status ${res.status}).`,
      `Unerwartete Antwort vom Server (Status ${res.status}).`));
  }
  return (await res.json()) as T;
}
