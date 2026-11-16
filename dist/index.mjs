// Servidor estático de produção — zero dependências (Node >= 18).
// Serve ./public (build do Astro), com redirecionamentos 301 das rotas antigas,
// cache imutável para /_astro, cabeçalhos de segurança e 404 próprio.
// Render executa: node --enable-source-maps ./dist/index.mjs
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip, createBrotliCompress, constants as zc } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = 'jlunipessoallda.eu';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.xml', '.txt', '.svg']);

// Rotas do site antigo (Replit) → novas rotas. Mantém o SEO acumulado.
const REDIRECTS = {
  '/orcamento': '/contactos', '/orcamentos': '/contactos', '/clientes': '/projetos', '/internacional': '/mao-de-obra',
  '/blog': '/projetos', '/admin': '/', '/index.html': '/', '/limpeza-tecnica': '/remodelacoes',
};

const CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
  "font-src 'self'", "connect-src 'self'", "frame-src https://www.openstreetmap.org", "media-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", 'upgrade-insecure-requests',
].join('; ');

const SECURITY = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin', 'Content-Security-Policy': CSP,
};

async function resolveFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = clean.endsWith('/') ? [join(clean, 'index.html')] : [clean, `${clean}.html`, join(clean, 'index.html')];
  for (const c of candidates) {
    const full = join(ROOT, c);
    if (!full.startsWith(ROOT)) return null;
    try { const s = await stat(full); if (s.isFile()) return { full, size: s.size, mtime: s.mtime }; } catch {}
  }
  return null;
}

function send(req, res, file, status = 200) {
  const ext = extname(file.full).toLowerCase();
  const headers = { ...SECURITY, 'Content-Type': MIME[ext] || 'application/octet-stream', Vary: 'Accept-Encoding' };
  headers['Cache-Control'] = req.url.startsWith('/_astro/')
    ? 'public, max-age=31536000, immutable'
    : ext === '.html' ? 'public, max-age=0, must-revalidate' : 'public, max-age=86400';
  headers['Last-Modified'] = file.mtime.toUTCString();
  if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(file.mtime.toUTCString()) && status === 200) {
    res.writeHead(304, headers); return res.end();
  }
  // Pedidos parciais (Range): obrigatório para vídeo no Safari/iOS.
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (range && status === 200 && !COMPRESSIBLE.has(ext)) {
    let start = range[1] === '' ? file.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : file.size - 1;
    if (start < 0) start = 0;
    end = Math.min(end, file.size - 1);
    if (start > end || start >= file.size) { res.writeHead(416, { 'Content-Range': `bytes */${file.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${file.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file.full, { start, end }).pipe(res);
  }
  headers['Accept-Ranges'] = 'bytes';
  const ae = String(req.headers['accept-encoding'] || '');
  let stream = createReadStream(file.full);
  if (COMPRESSIBLE.has(ext) && file.size > 1024) {
    if (ae.includes('br')) { headers['Content-Encoding'] = 'br'; stream = stream.pipe(createBrotliCompress({ params: { [zc.BROTLI_PARAM_QUALITY]: 5 } })); }
    else if (ae.includes('gzip')) { headers['Content-Encoding'] = 'gzip'; stream = stream.pipe(createGzip()); }
  } else headers['Content-Length'] = file.size;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  stream.pipe(res);
}

createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD', ...SECURITY }); return res.end(); }
    const url = new URL(req.url, `http://${req.headers.host || HOST}`);
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
    if (host.startsWith('www.')) { res.writeHead(301, { Location: `https://${HOST}${url.pathname}${url.search}` }); return res.end(); }
    let p = url.pathname;
    if (p === '/healthz' || p === '/api/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"status":"ok"}'); }
    if (p.startsWith('/api/')) { res.writeHead(410, { 'Content-Type': 'application/json', ...SECURITY }); return res.end('{"error":"Gone"}'); }
    if (p.length > 1 && p.endsWith('/')) { res.writeHead(301, { Location: p.slice(0, -1) + url.search }); return res.end(); }
    if (REDIRECTS[p]) { res.writeHead(301, { Location: REDIRECTS[p] }); return res.end(); }
    const file = await resolveFile(p);
    if (file) return send(req, res, file);
    const nf = await resolveFile('/404.html');
    return nf ? send(req, res, nf, 404) : (res.writeHead(404), res.end('Not found'));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(PORT, () => console.log(`JL Energy static server on :${PORT}`));
