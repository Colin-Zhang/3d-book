// 打包成一个 HTML：node tools/build.mjs --lesson <名字> [--out dist/<名字>.html]
// 产物双击就能打开（离线也行）：three.js、这一课的代码、样式、手写字体都塞进同一个文件
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const NAME = arg("lesson", "kinetic"), OUT = arg("out", `dist/${NAME}.html`);
const r = await build({
  stdin: { contents: `import * as L from "./src/lessons/${NAME}.js"; import { start } from "./src/main.js"; start(L, ${JSON.stringify(NAME)});`, resolveDir: ROOT, loader: "js" },
  bundle: true, format: "esm", minify: true, write: false, target: "es2022", legalComments: "none", logLevel: "error", preserveSymlinks: true,
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const font = readFileSync(join(ROOT, "fonts/LXGWWenKai-Regular.subset.woff2")).toString("base64");
const css = readFileSync(join(ROOT, "src/ui.css"), "utf8").replace(/url\("\.\.\/fonts\/[^"]+"\)/, `url(data:font/woff2;base64,${font})`);
const html = readFileSync(join(ROOT, "index.html"), "utf8")
  .replace(/<link rel="stylesheet"[^>]*>/, `<style>${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, "")
  .replace(/<script type="module" src="[^"]*"><\/script>/, () => `<script type="module">${js}</script>`);
mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), html);
console.log(`${OUT}（${(html.length / 1e6).toFixed(1)} MB）：双击就能打开`);
