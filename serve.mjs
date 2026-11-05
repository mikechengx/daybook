import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const html = fileURLToPath(new URL('./index.html', import.meta.url));
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path !== '/' && path !== '/index.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  try {
    const content = await readFile(html);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Could not load Daybook.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Daybook is ready at http://localhost:${port}`));
