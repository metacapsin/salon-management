// DEVELOPMENT ONLY. Needed only for the browser preview (expo start --web).
// The backend's /auth/mobile/* endpoints refuse requests that carry an Origin header (that is how browsers are kept out).
// A browser always adds Origin, so this tiny local proxy forwards requests to the backend without it.
// It listens on 127.0.0.1 only, so nothing else on the network can use it. The real Android app does not need it.
//
// Usage: node scripts/dev-proxy.js     then set EXPO_PUBLIC_API_URL=http://localhost:3001 in mobile/.env
const http = require('node:http')

// 127.0.0.1, not "localhost": "localhost" may be tried as IPv6 first, which made the first request after a pause fail with 502.
const TARGET = new URL(process.env.PROXY_TARGET || 'http://127.0.0.1:3000')
const PORT = Number(process.env.PROXY_PORT || 3001)
const ALLOWED_ORIGIN = process.env.PROXY_ALLOWED_ORIGIN || 'http://localhost:8081'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Salon-Id, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    Vary: 'Origin',
  }
}

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders())
      return res.end()
    }
    const headers = { ...req.headers, host: TARGET.host }
    delete headers.origin
    delete headers.referer
    const upstream = http.request(
      { hostname: TARGET.hostname, port: TARGET.port, path: req.url, method: req.method, headers },
      (up) => {
        // Drop the backend's own CORS headers (they name the website's origin); ours replace them.
        const kept = Object.fromEntries(Object.entries(up.headers).filter(([name]) => !name.startsWith('access-control-')))
        res.writeHead(up.statusCode, { ...kept, ...corsHeaders() })
        up.pipe(res)
      },
    )
    upstream.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders() })
      res.end(JSON.stringify({ error: { code: 'PROXY_ERROR', message: 'Backend not reachable.' } }))
    })
    req.pipe(upstream)
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Dev proxy: http://localhost:${PORT} -> ${TARGET.origin} (no Origin header)`))
