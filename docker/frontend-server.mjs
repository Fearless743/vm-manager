import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const port = 80;
const root = "/app/dist";

const contentType = (path) => {
  const ext = extname(path);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
};

const server = createServer(async (req, res) => {
  try {
    const path = req.url === "/" ? "/index.html" : req.url ?? "/index.html";
    const normalized = path.includes("..") ? "/index.html" : path;
    const filePath = join(root, normalized);
    const payload = await readFile(filePath);
    res.writeHead(200, {
      "content-type": contentType(filePath),
      "cache-control": "no-cache"
    });
    res.end(payload);
  } catch {
    const indexPath = join(root, "index.html");
    const index = await readFile(indexPath);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache"
    });
    res.end(index);
  }
});

server.listen(port, () => {
  console.log(`frontend server running at http://0.0.0.0:${port}`);
});
