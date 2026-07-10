"use strict";

(function registerWorldTreeForms(global) {
  global.WorldTreeForms = Object.freeze({
    value(root, selector, fallback = "") { return String(root?.querySelector(selector)?.value ?? fallback).trim(); },
    setBusy(button, busy, busyLabel = "处理中…") {
      if (!button) return;
      if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent || "";
      button.disabled = Boolean(busy);
      button.setAttribute("aria-busy", busy ? "true" : "false");
      button.textContent = busy ? busyLabel : button.dataset.idleLabel;
    },
    describeError(input, message = "") {
      if (!input) return;
      input.setAttribute("aria-invalid", message ? "true" : "false");
      if (message) input.setAttribute("data-error-message", message);
      else input.removeAttribute("data-error-message");
    }
  });
})(globalThis);
