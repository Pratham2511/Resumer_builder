/**
 * Lightweight server for ResumeForge
 * Serves pre-built Next.js static HTML + delegates API routes to Next.js
 * Uses much less memory than the full Next.js server
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PROJECT_DIR = path.join(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_DIR, '.next');
const STANDALONE_DIR = path.join(BUILD_DIR, 'standalone');
const STATIC_DIR = path.join(STANDALONE_DIR, '.next', 'static');
const PUBLIC_DIR = path.join(PROJECT_DIR, 'public');
const SERVER_DIR = path.join(BUILD_DIR, 'server', 'app');

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  const urlStr = req.url;
  const urlPath = urlStr.split('?')[0];

  // Log requests
  console.log(`${req.method} ${urlPath}`);

  // API routes - delegate to Next.js route handlers
  if (urlPath.startsWith('/api/')) {
    try {
      const routeName = urlPath.startsWith('/api/import-pdf') ? 'import-pdf' :
                        urlPath.startsWith('/api/import-docx') ? 'import-docx' : null;

      if (!routeName) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const routePath = path.join(SERVER_DIR, 'api', routeName, 'route.js');
      if (!fs.existsSync(routePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('API route not found');
        return;
      }

      // Collect request body
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);

      // Create web-standard Request
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
      }

      const webRequest = new Request(`http://localhost:${PORT}${urlStr}`, {
        method: req.method,
        headers,
        body: body.length > 0 ? body : undefined,
      });

      // Load and call route handler
      delete require.cache[require.resolve(routePath)]; // prevent mem buildup
      const handler = require(routePath);
      const method = req.method.toLowerCase();
      const routeHandler = handler[method] || handler.POST || handler.GET;

      if (!routeHandler) {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
      }

      const response = await routeHandler(webRequest);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const responseBody = await response.arrayBuffer();
      res.end(Buffer.from(responseBody));

    } catch (e) {
      console.error('API Error:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Static files from .next/static
  if (urlPath.startsWith('/_next/static/')) {
    const filePath = path.join(STANDALONE_DIR, urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': getMimeType(filePath), 'Content-Length': data.length });
      res.end(data);
      return;
    }
  }

  // _next/image or other _next paths
  if (urlPath.startsWith('/_next/')) {
    // Try standalone dir
    const filePath = path.join(STANDALONE_DIR, urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': getMimeType(filePath), 'Content-Length': data.length });
      res.end(data);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  // Public directory files
  if (urlPath !== '/') {
    const publicPath = path.join(PUBLIC_DIR, urlPath);
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      const data = fs.readFileSync(publicPath);
      res.writeHead(200, { 'Content-Type': getMimeType(publicPath), 'Content-Length': data.length });
      res.end(data);
      return;
    }
  }

  // Main page - serve pre-rendered HTML (SSR with client hydration)
  if (urlPath === '/' || urlPath === '/index.html') {
    const htmlPath = path.join(SERVER_DIR, 'index.html');
    if (fs.existsSync(htmlPath)) {
      const data = fs.readFileSync(htmlPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': data.length });
      res.end(data);
      return;
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  const mem = process.memoryUsage();
  console.log(`ResumeForge server on http://localhost:${PORT}`);
  console.log(`RSS: ${(mem.rss / 1024 / 1024).toFixed(1)}MB`);
});

// Keep memory in check
setInterval(() => {
  const mem = process.memoryUsage();
  if (mem.rss / 1024 / 1024 > 150) {
    // Prune require cache
    for (const key of Object.keys(require.cache)) {
      if (key.includes('route.js') || key.includes('chunks')) {
        delete require.cache[key];
      }
    }
    if (global.gc) global.gc();
  }
}, 15000);
