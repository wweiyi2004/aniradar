import { copyFile, access, mkdir, open } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { config } from "dotenv";

const root = process.cwd();
const target = resolve(root, ".env");

try {
  await access(target, constants.F_OK);
} catch {
  await copyFile(resolve(root, ".env.example"), target);
  console.log("[init] 已从 .env.example 创建 .env");
}

config({ path: target });
const databaseUrl = process.env.DATABASE_URL ?? "file:../../../data/aniradar.db";
if (databaseUrl.startsWith("file:")) {
  const raw = decodeURIComponent(databaseUrl.slice("file:".length));
  const path = isAbsolute(raw) ? raw : resolve(root, "packages/db/prisma", raw);
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "a");
  await handle.close();
}
