import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const MAX_PACKED_BYTES = 2 * 1024 * 1024;
const forbidden = /^(?:userData|audit|output|\.playwright-cli|node_modules|data\/engine\/worlds|data\/engine\/characters)\//;

const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "npm pack dry-run failed\n");
  process.exit(result.status || 1);
}

let packs;
try {
  packs = JSON.parse(result.stdout || "[]");
} catch (err) {
  process.stderr.write(`release:verify could not parse npm pack output: ${err.message}\n`);
  process.exit(1);
}

const pack = packs[0];
if (!pack) {
  process.stderr.write("release:verify found no npm pack result\n");
  process.exit(1);
}

const files = Array.isArray(pack.files) ? pack.files.map((item) => item.path || "") : [];
const blocked = files.filter((file) => forbidden.test(file));
const errors = [];

if (blocked.length) errors.push(`forbidden files in npm pack: ${blocked.join(", ")}`);
if (Number(pack.size || 0) > MAX_PACKED_BYTES) errors.push(`packed size ${pack.size} exceeds ${MAX_PACKED_BYTES}`);
if (!files.includes("LICENSE")) errors.push("LICENSE missing from npm pack");
if (!files.includes("server.js")) errors.push("server.js missing from npm pack");
if (!files.includes("ui-labels.js")) errors.push("ui-labels.js missing from npm pack");
if (!files.some((file) => file.startsWith("defaults/examples/"))) errors.push("defaults/examples missing from npm pack");

const summary = [
  `package: ${pack.name}@${pack.version}`,
  `packedSize: ${pack.size}`,
  `unpackedSize: ${pack.unpackedSize}`,
  `files: ${files.length}`
].join("\n");

writeFileSync("docs/reports/release-verify-latest.txt", `${summary}\n`, "utf8");

if (errors.length) {
  for (const error of errors) console.error(`[release:verify] FAIL: ${error}`);
  process.exit(1);
}

console.log(`[release:verify] PASS\n${summary}`);
