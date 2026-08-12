export const REQUIRED_STATUS = Object.freeze([
  "ENGINEERING_CLOSED = YES",
  "PREHUMAN_STABLE_BASELINE = ACHIEVED",
  "HUMAN_VALIDATION_PENDING = YES",
  "PLAYABLE_FINAL = NO",
  "FULL_PRODUCT_RELEASE_READY = NO",
  "V1.0_READY = NO"
]);

export function validateTruthDocuments(documents, { version } = {}) {
  const errors = [];
  for (const [file, text] of Object.entries(documents)) {
    if (!text.includes(version)) errors.push(`${file}: missing version ${version}`);
    for (const marker of REQUIRED_STATUS) if (!text.includes(marker)) errors.push(`${file}: missing ${marker}`);
    if (/PREHUMAN_STABLE_BASELINE\s*=\s*NOT ACHIEVED/i.test(text)) errors.push(`${file}: contradictory prehuman baseline state`);
    if (/PLAYABLE_FINAL\s*=\s*YES/i.test(text)) errors.push(`${file}: contradictory playable-final state`);
    if (/FULL_PRODUCT_RELEASE_READY\s*=\s*YES/i.test(text)) errors.push(`${file}: contradictory full-release state`);
    if (/V1\.0_READY\s*=\s*YES/i.test(text)) errors.push(`${file}: contradictory v1 state`);
    if (!/bounded/i.test(text)) errors.push(`${file}: baseline scope is not bounded`);
    if (!/workflow green/i.test(text) || !/provider PASS/i.test(text)) errors.push(`${file}: workflow green must be distinguished from provider PASS`);
  }
  return { ok: errors.length === 0, errors };
}
