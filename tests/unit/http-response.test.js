// tests/unit/http-response.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  errorPayload,
  HttpError,
  jsonError,
  jsonResponse,
  llmHttpError
} from "../../src/server/http-response.js";

function createMockResponse() {
  return {
    status: null,
    headers: null,
    body: "",
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
      return this;
    },
    end(body = "") {
      this.body = body;
      return this;
    }
  };
}

test("errorPayload preserves the existing API error contract", () => {
  assert.deepEqual(errorPayload("X_CODE", "用户提示", "debug detail"), {
    status: "error",
    error: "X_CODE",
    code: "X_CODE",
    userMsg: "用户提示",
    errorMsg: "用户提示",
    detail: "debug detail"
  });
});

test("llmHttpError maps known upstream status codes", () => {
  assert.equal(llmHttpError(401).code, "LLM_AUTH_FAILED");
  assert.equal(llmHttpError(403).code, "LLM_AUTH_FAILED");
  assert.equal(llmHttpError(402).code, "LLM_QUOTA_EXHAUSTED");
  assert.equal(llmHttpError(429).code, "LLM_RATE_LIMITED");
  assert.equal(llmHttpError(500).code, "LLM_UPSTREAM_ERROR");
  assert.equal(llmHttpError(404).code, "LLM_HTTP_ERROR");
});

test("jsonResponse writes JSON content type and serializes body", () => {
  const res = createMockResponse();
  jsonResponse(res, { ok: true }, 201);
  assert.equal(res.status, 201);
  assert.equal(res.headers["Content-Type"], "application/json; charset=utf-8");
  assert.equal(res.body, JSON.stringify({ ok: true }));
});

test("jsonError writes the standard error payload", () => {
  const res = createMockResponse();
  jsonError(res, 418, "TEAPOT", "不是茶壶", "short detail");
  assert.equal(res.status, 418);
  assert.deepEqual(JSON.parse(res.body), {
    status: "error",
    error: "TEAPOT",
    code: "TEAPOT",
    userMsg: "不是茶壶",
    errorMsg: "不是茶壶",
    detail: "short detail"
  });
});

test("HttpError carries status, code, user message, and detail", () => {
  const err = new HttpError(413, "BODY_TOO_LARGE", "请求内容过大。", "received=1");
  assert.equal(err.message, "请求内容过大。");
  assert.equal(err.status, 413);
  assert.equal(err.code, "BODY_TOO_LARGE");
  assert.equal(err.userMsg, "请求内容过大。");
  assert.equal(err.detail, "received=1");
});
