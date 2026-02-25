const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const HOST = '127.0.0.1';
const PORT = 8080;
const ROOT_DIR = __dirname;
const LOG_DIR = 'C:\\Users\\linene\\exjobbGH\\loggfiler';
const LOG_FILE = path.join(LOG_DIR, 'spelsession-logg.txt');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function sanitizePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const requested = decoded === '/' ? '/game.html' : decoded;
  const resolved = path.resolve(ROOT_DIR, `.${requested}`);
  if (!resolved.startsWith(ROOT_DIR)) return null;
  return resolved;
}

async function appendLog(content) {
  await fsp.mkdir(LOG_DIR, { recursive: true });
  await fsp.appendFile(LOG_FILE, content, 'utf8');
}

async function handleLogPost(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 2 * 1024 * 1024) {
      req.destroy();
    }
  });

  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body || '{}');
      const content = typeof parsed.content === 'string' ? parsed.content : '';
      if (!content) {
        return sendJson(res, 400, { ok: false, error: 'Missing content' });
      }

      await appendLog(content);
      return sendJson(res, 200, { ok: true, logFile: LOG_FILE });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: String(error.message || error) });
    }
  });
}

function serveStaticFile(filePath, res) {
  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Server error');
    });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url && req.url.startsWith('/api/log')) {
    return handleLogPost(req, res);
  }

  if (req.method === 'GET') {
    const filePath = sanitizePath(req.url);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    return serveStaticFile(filePath, res);
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/game.html`);
  console.log(`Log file: ${LOG_FILE}`);
});
