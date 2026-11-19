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
// Expo moves to 8082, 8083... when 8081 is busy, so any localhost/127.0.0.1 port is allowed (this proxy only listens on 127.0.0.1).
// PROXY_ALLOWED_ORIGIN (one exact origin) still works if you want to lock it down.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function allowedOrigin(origin) {
  if (process.env.PROXY_ALLOWED_ORIGIN) return process.env.PROXY_ALLOWED_ORIGIN
  return origin && LOCAL_ORIGIN.test(origin) ? origin : 'http://localhost:8081'
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(origin),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Salon-Id, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    Vary: 'Origin',
  }
}

const server = http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req.headers.origin))
      return res.end()
    }
    const origin = req.headers.origin
    const headers = { ...req.headers, host: TARGET.host }
    delete headers.origin
    delete headers.referer
    const upstream = http.request(
      // agent: false = a fresh connection every time. The backend closes idle connections after a few seconds, and reusing
      // such a dead one made the first request after a pause fail with 502 ("server is not responding").
      { hostname: TARGET.hostname, port: TARGET.port, path: req.url, method: req.method, headers, agent: false },
      (up) => {
        // Drop the backend's own CORS headers (they name the website's origin); ours replace them.
        const kept = Object.fromEntries(Object.entries(up.headers).filter(([name]) => !name.startsWith('access-control-')))
        res.writeHead(up.statusCode, { ...kept, ...corsHeaders(origin) })
        up.pipe(res)
      },
    )
    upstream.on('error', (error) => {
      console.error(`[proxy] ${req.method} ${req.url} -> backend error: ${error.code ?? error.name} ${error.message}`)
      res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders(origin) })
      res.end(JSON.stringify({ error: { code: 'PROXY_ERROR', message: 'Backend not reachable.' } }))
    })
    req.pipe(upstream)
  })

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use: the dev proxy is probably already running. Nothing more to do, or stop it first.`)
    process.exit(0)
  }
  throw error
})

server.listen(PORT, '127.0.0.1', () => console.log(`Dev proxy: http://localhost:${PORT} -> ${TARGET.origin} (no Origin header)`))
