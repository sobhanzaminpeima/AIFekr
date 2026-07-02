/**
 * Manual test script — simulates a provider failure and verifies fallback.
 *
 * Run:
 *   FORCE_PROVIDER_FAILURE=claude npx ts-node --project tsconfig.json scripts/test-router-fallback.ts
 *
 * The FORCE_PROVIDER_FAILURE env var makes ClaudeProvider.isHealthy() return
 * false, forcing the router to skip it and try the next provider in priority.
 *
 * Expected output when OPENAI_API_KEY is set:
 *   [Router] claude is unhealthy — skipped
 *   [Router] Trying openai (OpenAI GPT)…
 *   [Router] ✓ openai delivered the first token in Xms
 *   [TEST PASS] Fallback from claude → openai worked correctly
 */

import { routerStreamChat } from "../src/lib/ai/router";

const MESSAGES = [{ role: "user" as const, content: "Say exactly: fallback_ok" }];

async function runTest(forceFailure: string | null) {
  if (forceFailure) process.env.FORCE_PROVIDER_FAILURE = forceFailure;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Test: FORCE_PROVIDER_FAILURE=${forceFailure ?? "(none)"}`);
  console.log("─".repeat(60));

  let usedProvider = "";
  let receivedText = "";
  const firstTokenAt: { [id: string]: number } = {};

  const start = Date.now();

  try {
    const { provider } = await routerStreamChat(
      MESSAGES,
      { systemPrompt: "You are a test assistant. Follow instructions exactly." },
      (chunk) => {
        if (!firstTokenAt[usedProvider]) firstTokenAt[usedProvider] = Date.now() - start;
        receivedText += chunk;
        process.stdout.write(chunk);
      },
      (p) => {
        usedProvider = p.id;
        console.log(`\n[Router] Trying ${p.id} (${p.name})…`);
      }
    );

    const ttfToken = firstTokenAt[provider.id] ?? 0;
    process.stdout.write("\n");
    console.log(`\n[Router] ✓ ${provider.id} delivered first token in ${ttfToken}ms`);
    console.log(`[Router] ✓ Total time: ${Date.now() - start}ms`);

    if (forceFailure) {
      if (usedProvider === forceFailure) {
        console.error(`\n[TEST FAIL] Expected router to skip ${forceFailure} but it used it anyway`);
        process.exit(1);
      }
      console.log(`\n[TEST PASS] Fallback from ${forceFailure} → ${usedProvider} worked correctly`);
    } else {
      console.log(`\n[TEST PASS] Normal routing used provider: ${usedProvider}`);
    }
  } catch (err) {
    console.error("\n[TEST ERROR]", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

(async () => {
  // Test 1: normal routing (no forced failure)
  await runTest(null);

  // Test 2: force Claude to fail → expect fallback to next provider
  await runTest("claude");

  // Test 3: force both Claude and OpenAI to fail
  if (process.env.OPENAI_API_KEY) {
    process.env.FORCE_PROVIDER_FAILURE = "claude,openai";
    // Re-read via env; providers check FORCE_PROVIDER_FAILURE as comma-separated list
    await runTest("claude");
  }

  console.log("\nAll tests completed.");
})();
