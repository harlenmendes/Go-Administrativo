/**
 * Servidor local leve para testar as Serverless Functions (/api/* e OAuth)
 * em paralelo com `npm run dev` (Vite proxy na porta 3001).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'));
loadEnvFile(path.resolve(__dirname, '..', '.env'));

const handler = require('../api/index.js');
const PORT = Number(process.env.API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  // Adapta req/res do Node http para interface compatível com Vercel Serverless
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const rawBody = Buffer.concat(chunks).toString('utf8');
    if (rawBody && (req.headers['content-type'] || '').includes('application/json')) {
      try {
        req.body = JSON.parse(rawBody);
      } catch {
        req.body = rawBody;
      }
    } else {
      req.body = rawBody || undefined;
    }

    const urlObj = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
    req.query = Object.fromEntries(urlObj.searchParams.entries());

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(data));
      return res;
    };
    res.send = (data) => {
      if (typeof data === 'object' && data !== null) {
        return res.json(data);
      }
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      res.end(String(data ?? ''));
      return res;
    };

    await handler(req, res);
  });
});

server.listen(PORT, () => {
  console.log(`[Go-Administrativo API] Rodando em http://localhost:${PORT}`);
});

