// Turns the archive-save / world-copy slash patches into real persistence ops.
// Disk is the source of truth for naming: the write layer (persistence-service)
// allocates the final file/dir name deterministically. Archives never overwrite
// unless the user explicitly asks; world copies never overwrite.
import { execSlashCommand } from "./commands.js";
import { embedRuntimeInArchive } from "./archive-state.js";

export const SLASH_WRITE_OP = Object.freeze({ ARCHIVE: "slash-archive-file", WORLD_COPY: "slash-world-copy" });
const PERSISTED_SLASH = /^\/(\S*存档\S*|世界\s+(复制|copy|clone))(\s|$)/;

export function slashWriteOps({ input, engineState, model } = {}) {
  // server appends the real-play prompt block after a blank line; only the user's command line counts.
  const text = String(input || "").trim().split(/\r?\n/)[0].trim();
  if (!PERSISTED_SLASH.test(text)) return [];
  const patch = execSlashCommand({ input: text, engineState, model })?.patch;
  const payload = patch?.payload || {};
  if (patch?.type === "archive-save" && payload.name) {
    const archive = embedRuntimeInArchive({ name: payload.name, mode: payload.dataMode, round: Number(model?.turnCount) || 0 }, payload.runtimeSnapshot || {});
    return [{ op: SLASH_WRITE_OP.ARCHIVE, name: payload.name, overwrite: payload.overwrite === true, payload: archive }];
  }
  if (patch?.type === "world-copy" && payload.source && payload.target) {
    return [{ op: SLASH_WRITE_OP.WORLD_COPY, source: payload.source, target: payload.target, label: payload.label || "" }];
  }
  return [];
}

export function isSlashWriteOp(op = {}) {
  return Object.values(SLASH_WRITE_OP).includes(op?.op);
}
