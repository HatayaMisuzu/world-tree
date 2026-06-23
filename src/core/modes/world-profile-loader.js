import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonSync } from "../../server/fs-utils.js";
import { normalizeWorldProfile, validateWorldProfile } from "./world-profile-schema.js";
export function loadWorldProfile(profileId, options = {}) { const root = options.profilesRoot || fileURLToPath(new URL("../../../defaults/world-profiles/", import.meta.url)); const raw = readJsonSync(resolve(root, `${profileId}.json`), null); if (!raw) return { ok: false, profile: null, warnings: [`profile_not_found:${profileId}`] }; const profile = normalizeWorldProfile(raw); const validation = validateWorldProfile(profile); return { ok: validation.ok, profile: validation.ok ? profile : null, warnings: validation.errors }; }
