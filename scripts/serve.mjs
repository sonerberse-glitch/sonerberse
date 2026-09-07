import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let preview = false;
let port = 8765;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--preview') preview = true;
  else if (args[i] === '--port' && args[i + 1]) port = Number(args[++i]);
  else throw new Error('Kullanım: node scripts/serve.mjs [--preview] [--port 8765]');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Geçerli bir port gerekli.');
const outputDir = path.join(rootDir, preview ? '.preview' : 'dist');
await fs.access(path.join(outputDir, 'index.html'));
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  if (preview) response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.')) || pathname.includes('\\')) throw new Error('Invalid path');
    let filename = path.resolve(outputDir, `.${pathname}`);
    if (filename !== outputDir && !filename.startsWith(`${outputDir}${path.sep}`)) throw new Error('Invalid path');
    let stat = await fs.stat(filename);
    if (stat.isDirectory()) {
      if (!pathname.endsWith('/')) { response.writeHead(308, { Location: `${pathname}/${new URL(request.url, 'http://127.0.0.1').search}` }); response.end(); return; }
      filename = path.join(filename, 'index.html');
      stat = await fs.stat(filename);
    }
    if (!stat.isFile()) throw new Error('Not a file');
    const body = await fs.readFile(filename);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : 'Sayfa bulunamadı.');
  }
});
server.on('error', error => { console.error(`Önizleme başlatılamadı: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Yerel önizleme: http://127.0.0.1:${port} (${preview ? '.preview' : 'dist'})`));
