// Servidor estático mínimo para previsualizar dist/ en local.
//   node src/serve.mjs   ->   http://localhost:4321
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 4321;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  let full = path.join(DIST, p);
  if (!full.startsWith(DIST)) return null;
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  if (fs.existsSync(full + ".html")) return full + ".html";
  const asDir = path.join(full, "index.html");
  if (fs.existsSync(asDir)) return asDir;
  return null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url || "/");
  if (file) {
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
    return;
  }
  const notFound = path.join(DIST, "404.html");
  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "404");
});

if (!fs.existsSync(DIST)) {
  console.error('No existe dist/. Corré primero:  node src/build.mjs');
  process.exit(1);
}
server.listen(PORT, () => {
  console.log(`Que Hay Panamá  ->  http://localhost:${PORT}`);
});
