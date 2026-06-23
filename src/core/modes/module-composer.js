import { getModulesForMode } from "./mode-module-map.js";
import { MODULE_MANIFEST } from "../modules/module-manifest.js";
import { loadWorldProfile } from "./world-profile-loader.js";

export function composeModulesForMode(modeId, profileId, userOptions = {}) {
  const base = getModulesForMode(modeId); const loaded = profileId ? loadWorldProfile(profileId, userOptions) : { ok: true, profile: null, warnings: [] }; const profile = loaded.profile;
  const warnings = [...loaded.warnings];
  const profileAllowed = !profile || profile.baseModes.includes(modeId);
  if (profile && !profileAllowed) warnings.push(`profile_mode_mismatch:${profileId}:${modeId}`);
  const requested = [...base, ...(profileAllowed ? profile?.defaultModules || [] : []), ...(userOptions.enabledModules || [])];
  const enabled = new Set(userOptions.enabledModules || []);
  const disabled = new Set([...(profile?.disabledByDefault || []).filter((id) => !enabled.has(id)), ...(userOptions.disabledModules || [])]);
  const modules = [];
  for (const id of [...new Set(requested)]) { if (disabled.has(id)) continue; if (!MODULE_MANIFEST[id]) { warnings.push(`unregistered_module:${id}`); continue; } modules.push(id); }
  return { modeId, profileId: profile?.id || null, modules, warnings, sources: { base, profile: profileAllowed ? profile?.defaultModules || [] : [], user: userOptions.enabledModules || [], disabled: [...disabled] } };
}
