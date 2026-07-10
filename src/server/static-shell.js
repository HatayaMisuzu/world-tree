// Bounded server runtime extracted from server.js.
export function createStaticShell(deps = {}) {
  const {
    checkRateLimit,
    RATE_MAX_STATIC,
    jsonError,
    ROOT,
    join,
    existsSync,
    extname,
    createReadStream,
    readFileSync
  } = deps;

  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf"
  };
  
  const PUBLIC_STATIC_FILES = new Map([
    ["/", "world-tree-console.html"],
    ["/world-tree-console.html", "world-tree-console.html"],
    ["/world-tree-console.css", "world-tree-console.css"],
    ["/world-tree-client-core.js", "world-tree-client-core.js"],
    ["/ui-labels.js", "ui-labels.js"],
    ["/browser/app/product-registry.js", "browser/app/product-registry.js"],
    ["/browser/app/navigation.js", "browser/app/navigation.js"],
    ["/browser/state/app-store.js", "browser/state/app-store.js"],
    ["/browser/components/feedback.js", "browser/components/feedback.js"],
    ["/browser/components/forms.js", "browser/components/forms.js"],
    ["/browser/components/product-components.js", "browser/components/product-components.js"],
    ["/browser/views/core-views.js", "browser/views/core-views.js"],
    ["/browser/views/creation-settings-views.js", "browser/views/creation-settings-views.js"],
    ["/browser/controllers/navigation-controller.js", "browser/controllers/navigation-controller.js"],
    ["/browser/controllers/entry-controller.js", "browser/controllers/entry-controller.js"],
    ["/browser/controllers/play-controller.js", "browser/controllers/play-controller.js"],
    ["/browser/controllers/content-controller.js", "browser/controllers/content-controller.js"],
    ["/browser/controllers/settings-controller.js", "browser/controllers/settings-controller.js"],
    ["/browser/controllers/character-v2-controller.js", "browser/controllers/character-v2-controller.js"],
    ["/world-tree-console.js", "world-tree-console.js"]
  ]);
  
  async function serveStatic(req, res) {
    // 速率限制
    if (!checkRateLimit(req.socket?.remoteAddress || "127.0.0.1", RATE_MAX_STATIC)) {
      res.writeHead(429, { "Content-Type": "text/plain" });
      return res.end("Too Many Requests");
    }
    const pathname = (() => {
      try { return decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
      catch { return "/"; }
    })();
    const publicFile = PUBLIC_STATIC_FILES.get(pathname);
    if (!publicFile) {
      if (extname(pathname)) return jsonError(res, 404, "STATIC_NOT_FOUND", "静态资源不存在。");
      return serveConsoleShell(res);
    }
    const filePath = join(ROOT, publicFile);
    if (!existsSync(filePath)) return serveConsoleShell(res);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  }
  
  function serveConsoleShell(res) {
    const filePath = join(ROOT, "world-tree-console.html");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    createReadStream(filePath).pipe(res);
  }
  
  // ═══════════════════════════════════════════════════════════════
  //  HTTP 请求体解析
  // ═══════════════════════════════════════════════════════════════
  
  // ═══════════════════════════════════════════════════════════════
  //  API 路由处理器
  // ═══════════════════════════════════════════════════════════════

  return { PUBLIC_STATIC_FILES, serveStatic, serveConsoleShell };
}
