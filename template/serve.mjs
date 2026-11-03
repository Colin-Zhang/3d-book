// 本地预览：node serve.mjs → 浏览器打开 http://localhost:5174
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf" };

export function serve(port = 0) {
  const srv = createServer(async (req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    try { const buf = await readFile(join(ROOT, p || "index.html")); res.writeHead(200, { "Content-Type": TYPES[extname(p)] ?? "application/octet-stream" }); res.end(buf); }
    catch { res.writeHead(404); res.end("not found"); }
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok({ srv, port: srv.address().port })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { port } = await serve(Number(process.env.PORT ?? 5174));
  console.log(`预览：http://localhost:${port}/index.html`);
}
