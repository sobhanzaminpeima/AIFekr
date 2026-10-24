import { execSync } from "child_process";
import { rmSync } from "fs";
import path from "path";

/**
 * Rebuilds the isolated test database from the migration history before every
 * run, so tests never depend on a hand-maintained prisma/vitest.db whose schema
 * has drifted (that drift is what used to fail ~150 tests with "table does not
 * exist"). Skipped when the caller supplies their own DATABASE_URL.
 */
export default function setup() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== "file:./vitest.db") return;
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(path.join(__dirname, "prisma", `vitest.db${suffix}`), { force: true });
  // The generated client stores the schema location it was generated from and
  // resolves `file:./vitest.db` against it; a client generated in another
  // checkout silently points tests at that checkout's database.
  execSync("npx prisma generate", { stdio: "inherit" });
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: "file:./vitest.db" } });
}
