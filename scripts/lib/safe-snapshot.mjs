import { createHash } from "node:crypto";

export const MAX_TRACKED_FILE_BYTES = 10 * 1024 * 1024;
export const FORBIDDEN_PATH_PATTERNS = Object.freeze([
  /(^|\/)userData(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.playwright-cli(\/|$)/i,
  /(^|\/)(?:browser-profile|profile)(\/|$)/i,
  /(^|\/)secrets\.json$/i,
  /(^|\/)\.env(?:\.|$)/i,
  /(?:^|\/)coverage(?:\/|$)/i,
  /\.(?:log|tmp|cache)$/i
]);

export const SECRET_PATTERNS = Object.freeze([
  { id: "openai_key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: "github_token", re: /\bgh[opsu]_[A-Za-z0-9]{30,}\b/g },
  { id: "private_key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: "generic_secret", re: /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9_\-]{24,}/gi }
]);

export function normalizeTrackedPath(path = "") {
  return String(path || "").replaceAll("\\", "/").replace(/^\.\//, "");
}

export function forbiddenTrackedPath(path = "") {
  const normalized = normalizeTrackedPath(path);
  return FORBIDDEN_PATH_PATTERNS.find(pattern => pattern.test(normalized))?.source || "";
}

export function findSecrets(text = "") {
  const findings = [];
  for (const pattern of SECRET_PATTERNS) {
    pattern.re.lastIndex = 0;
    const matches = [...String(text).matchAll(pattern.re)];
    const actionable = matches.some(match => {
      if (pattern.id === "private_key") return true;
      const value = String(match[0] || "").toLowerCase();
      return !/(?:example|placeholder|dummy|fake|test-key|this-is-a-secret|1234567890|abcdefghijkl|prefix-super-secret-tail|redacted)/.test(value);
    });
    if (actionable) findings.push(pattern.id);
    pattern.re.lastIndex = 0;
  }
  return findings;
}

export function buildSnapshotManifest({ version, head, archiveName, archiveBytes, files, archiveBuffer }) {
  return {
    schemaVersion: 1,
    version,
    head,
    generatedAt: new Date().toISOString(),
    archive: archiveName,
    archiveBytes,
    archiveSha256: createHash("sha256").update(archiveBuffer).digest("hex"),
    trackedFileCount: files.length,
    files
  };
}
