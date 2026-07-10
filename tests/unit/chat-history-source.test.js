import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readBrowserSource } from "../../scripts/lib/browser-source.mjs";

const consoleCode = readBrowserSource();

test("chat history uses server records as the source of truth and localStorage only for drafts", () => {
  const chBlock = consoleCode.slice(consoleCode.indexOf("const CH ="), consoleCode.indexOf("const Views ="));
  assert.ok(chBlock.includes("wt-chat-draft-"));
  assert.ok(chBlock.includes("localStorage.removeItem(CH.key(m))"));
  assert.equal(chBlock.includes("JSON.stringify(AS.messages"), false);

  const loadServerBlock = chBlock.slice(chBlock.indexOf("async loadServer"), chBlock.indexOf("},\n};"));
  const catchBlock = loadServerBlock.slice(loadServerBlock.lastIndexOf("} catch"));
  assert.ok(loadServerBlock.includes("AS.messages = Array.isArray(res.messages)"));
  assert.ok(loadServerBlock.includes("AS.messages = []"));
  assert.equal(catchBlock.includes("CH.loadLocal(m);"), false);
});
