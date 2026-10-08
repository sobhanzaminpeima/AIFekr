/* Invoke from the deployment scheduler; uses the existing authenticated API.
 * No credentials in CLI arguments, no provider retries and no second wallet. */
async function main() {
  const origin = new URL(process.env.APP_URL || "http://127.0.0.1:3000");
  if (origin.username || origin.password || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))) throw Error("Invalid application origin");
  if (!process.env.CRON_SECRET) throw Error("CRON_SECRET is required");
  const response = await fetch(new URL("/api/cron/seo-intelligence", origin), {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(240_000),
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  if (!response.ok) throw Error(`SEO worker returned HTTP ${response.status}`);
  const result = await response.json();
  if (result.processed !== null && typeof result.processed !== "string") throw Error("Invalid worker response");
  console.log(`SEO worker completed; processed ${result.processed === null ? 0 : 1} job(s).`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "SEO worker failed"); process.exitCode = 1; });
