// tests/unit/http-request.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import {
  badJsonError,
  bodyTooLargeError,
  invalidJsonBodyError,
  createReadBody,
  invalidJsonBodyError,
  isPlainObject,
  parseContentLength,
  readJsonBody
} from "../../src/server/http-request.js";
import { HttpError } from "../../src/server/http-response.js";

function requestFromBody(body, headers = {}) {
  const req = new PassThrough();
  req.headers = headers;
  queueMicrotask(() => req.end(body));
  return req;
}

test("parseContentLength returns a safe positive number", () => {
  assert.equal(parseContentLength({ "content-length": "12" }), 12);
  assert.equal(parseContentLength({ "Content-Length": "13" }), 13);
  assert.equal(parseContentLength({ "content-length": "-1" }), 0);
  assert.equal(parseContentLength({ "content-length": "nope" }), 0);
  assert.equal(parseContentLength({}), 0);
});

test("readJsonBody parses a JSON object", async () => {
  const req = requestFromBody(JSON.stringify({ ok: true }), { "content-length": "11" });
  assert.deepEqual(await readJsonBody(req, 1024), { ok: true });
});

test("readJsonBody returns an empty object for an empty body", async () => {
  const req = requestFromBody("", { "content-length": "0" });
  assert.deepEqual(await readJsonBody(req, 1024), {});
});

test("readJsonBody rejects Content-Length values over the limit", async () => {
  const req = requestFromBody("{}", { "content-length": "999" });
  await assert.rejects(
    readJsonBody(req, 10),
    (err) => err instanceof HttpError && err.status === 413 && err.code === "BODY_TOO_LARGE"
  );
});

test("readJsonBody rejects streamed bodies over the limit", async () => {
  const req = new PassThrough();
  req.headers = {};
  const promise = readJsonBody(req, 3);
  req.write("12");
  req.write("34");
  await assert.rejects(
    promise,
    (err) => err instanceof HttpError && err.status === 413 && err.code === "BODY_TOO_LARGE"
  );
});

test("readJsonBody rejects invalid JSON with an INVALID_JSON HttpError", async () => {
  const req = requestFromBody("{broken", { "content-length": "7" });
  await assert.rejects(
    readJsonBody(req, 1024),
    (err) => err instanceof HttpError && err.status === 400 && err.code === "INVALID_JSON"
  );
});

for (const [label, body] of [
  ["array", "[]"],
  ["null", "null"],
  ["string", '"text"'],
  ["number", "42"]
]) {
  test(`readJsonBody rejects ${label} JSON with INVALID_JSON_BODY`, async () => {
    await assert.rejects(
      readJsonBody(requestFromBody(body), 1024),
      (err) => err instanceof HttpError && err.status === 400 && err.code === "INVALID_JSON_BODY"
    );
  });
}

test("isPlainObject accepts only plain JSON-object shapes", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject(Object.create(null)), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject("text"), false);
});

test("createReadBody binds the default limit while allowing an override", async () => {
  const readBody = createReadBody({ limit: 32 });
  assert.deepEqual(await readBody(requestFromBody('{"a":1}')), { a: 1 });

  await assert.rejects(
    readBody(requestFromBody('{"too":"large"}'), 3),
    (err) => err instanceof HttpError && err.status === 413
  );
});

test("error factories return stable HttpError objects", () => {
  const large = bodyTooLargeError("large");
  assert.equal(large.status, 413);
  assert.equal(large.code, "BODY_TOO_LARGE");

  const bad = badJsonError("bad");
  assert.equal(bad.status, 400);
  assert.equal(bad.code, "INVALID_JSON");

  const invalidBody = invalidJsonBodyError("invalid");
  assert.equal(invalidBody.status, 400);
  assert.equal(invalidBody.code, "INVALID_JSON_BODY");
});
