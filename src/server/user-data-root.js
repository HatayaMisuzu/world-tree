import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SERVER_DIR, "../..");

export function getUserDataRoot(env = process.env) {
  const raw = String(env?.WORLD_TREE_USER_DATA_DIR || "").trim();
  return raw ? resolve(raw) : join(ROOT_DIR, "userData");
}

export function userDataPath(...segments) {
  return join(getUserDataRoot(), ...segments);
}
