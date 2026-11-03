// 开发时的入口：index.html?lesson=<名字>（默认 kinetic）
import { start } from "./main.js";
const NAME = new URLSearchParams(location.search).get("lesson") || "kinetic";
start(await import(`./lessons/${NAME}.js`), NAME);
