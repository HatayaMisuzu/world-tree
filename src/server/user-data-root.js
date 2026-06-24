import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SERVER_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SERVER_DIR, "../..");

export function getUserDataRoot(env = process.env) {
  const raw = env.WORLD_TREE_USER_DATA_DIR;
  return raw ? path.resolve(raw) : path.join(ROOT_DIR, "userData");
}

export function userDataPath(...segments) {
  return path.join(getUserDataRoot(), ...segments);
}
