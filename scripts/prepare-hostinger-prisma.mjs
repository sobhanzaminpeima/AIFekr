import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve("prisma/schema.prisma");
const targetPath = resolve("prisma/schema.hostinger.prisma");

const source = await readFile(sourcePath, "utf8");
const mysqlSchema = source.replace(
  /provider\s*=\s*"sqlite"/,
  'provider = "mysql"',
);

if (mysqlSchema === source) {
  throw new Error("Could not find the SQLite datasource in prisma/schema.prisma");
}

await writeFile(targetPath, mysqlSchema, "utf8");
console.log("Prepared prisma/schema.hostinger.prisma for MySQL deployment.");
