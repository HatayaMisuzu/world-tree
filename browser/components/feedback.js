"use strict";

(function registerWorldTreeFeedback(global) {
  const ERROR_MESSAGES = Object.freeze({
    LLM_NOT_CONFIGURED: "模型服务尚未配置。前往设置填写服务地址、模型和密钥。",
    LLM_TIMEOUT: "模型响应超时。你的输入已保留，可以重试或调高超时时间。",
    LLM_ABORTED: "生成已停止。未完成的回复不会被当作完整内容保存。",
    IMPORT_INVALID: "导入内容无法识别。请检查文件格式后重新选择。",
    DATA_CORRUPT_RECOVERABLE: "部分本地数据无法读取，可以从最近备份恢复。",
    DATA_CORRUPT_FATAL: "本地数据已损坏且没有可用恢复点，请先导出诊断信息。"
  });
  global.WorldTreeFeedback = Object.freeze({
    messageFor(code, fallback = "操作没有完成，请稍后重试。") { return ERROR_MESSAGES[code] || fallback; },
    toneFor(status = "") {
      if (["ok", "success", "saved", "connected"].includes(status)) return "success";
      if (["error", "failed", "danger"].includes(status)) return "danger";
      if (["warning", "partial", "aborted"].includes(status)) return "warning";
      return "info";
    }
  });
})(globalThis);
