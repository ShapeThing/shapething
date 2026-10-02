import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

// Matches https://shapething.com and any of its subdomains (e.g. https://app.shapething.com)
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*shapething\.com$/i

// Matches http(s):// origins on RFC1918 private ranges, loopback, and link-local addresses
// (e.g. http://192.168.1.10:3000), so local/LAN dev servers can use the proxy too.
const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const PRIVATE_IPV4_HOST = `(?:127\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}|10\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}|172\\.(?:1[6-9]|2\\d|3[01])\\.${IPV4_OCTET}\\.${IPV4_OCTET}|192\\.168\\.${IPV4_OCTET}\\.${IPV4_OCTET}|169\\.254\\.${IPV4_OCTET}\\.${IPV4_OCTET})`
const PRIVATE_IP_ORIGIN_PATTERN = new RegExp(`^https?:\\/\\/(?:localhost|${PRIVATE_IPV4_HOST})(:\\d+)?$`)

function isAllowedOrigin(origin: string | null): origin is string {
  return (
    typeof origin === 'string' &&
    (ALLOWED_ORIGIN_PATTERN.test(origin) || PRIVATE_IP_ORIGIN_PATTERN.test(origin))
  )
}

function corsHeaders(origin: string) {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Vary', 'Origin')
  // Responses are per-Origin and proxy arbitrary/authenticated upstream content, so they
  // must never be cached by an intermediary (e.g. Cloudflare) regardless of what
  // Cache-Control the proxied target itself returns.
  headers.set('Cache-Control', 'private, no-store')
  return headers
}

async function handleRequest(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin')

  if (!isAllowedOrigin(origin)) {
    return new Response('Origin not allowed', { status: 403 })
  }

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url') // Get the target URL from the `url` query parameter

  if (!targetUrl) {
    return new Response('Missing "url" query parameter', { status: 400 })
  }

  // Build a clean header set for the upstream request instead of forwarding the
  // client's headers verbatim. Blindly cloning them leaked this proxy's own
  // Origin/Cookie/Referer to whatever third-party `url` was requested, and also
  // forwarded the browser's real User-Agent (e.g. a Chrome UA) even though this
  // process makes the actual connection — that UA/fingerprint mismatch is what
  // triggers bot mitigation (managed challenges) on targets like w3.org.
  const headers = new Headers()
  const accept = request.headers.get('Accept')
  if (accept) headers.set('Accept', accept)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('Content-Type') ?? 'application/json'
    headers.set('Content-Type', contentType)
  }

  // Create a request for the target URL
  const targetRequest = new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    duplex: request.method !== 'GET' && request.method !== 'HEAD' ? 'half' : undefined,
  })

  try {
    const response = await fetch(targetRequest)

    const newHeaders = new Headers(response.headers)

    // `fetch` transparently decompresses gzip/br bodies, but leaves the original
    // Content-Encoding/Content-Length from the wire untouched on response.headers.
    // Forwarding those verbatim describes bytes we're no longer sending, so the
    // client tries to decode already-decoded content and fails.
    newHeaders.delete('Content-Encoding')
    newHeaders.delete('Content-Length')

    // Add CORS headers restricted to the validated shapething.com origin
    for (const [key, value] of corsHeaders(origin)) {
      newHeaders.set(key, value)
    }

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    })
  } catch {
    return new Response('Error fetching the target URL', { status: 500 })
  }
}

function toFetchRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost'
  const url = `http://${host}${req.url}`

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : undefined,
    duplex: hasBody ? 'half' : undefined,
  })
}

async function writeFetchResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status
  for (const [key, value] of response.headers) {
    res.setHeader(key, value)
  }

  if (!response.body) {
    res.end()
    return
  }

  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(value)
  }
  res.end()
}

const port = Number(process.env.PORT) || 8080

createServer(async (req, res) => {
  try {
    const request = toFetchRequest(req)
    const response = await handleRequest(request)
    await writeFetchResponse(response, res)
  } catch {
    res.statusCode = 500
    res.end('Internal error')
  }
}).listen(port, () => {
  console.log(`CORS proxy listening on :${port}`)
})
