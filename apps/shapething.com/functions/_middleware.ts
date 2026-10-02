// Cloudflare Pages middleware: content negotiation for the ShapeThing ontology (http://shapething.com/).
//
// The namespace IRI (/) and every term IRI (e.g. /GeoEditor) dereference to the ontology:
// - an RDF client (Accept preferring text/turtle over text/html) gets /index.ttl
// - a browser asking for a term gets a 303 to that term on /documentation/ontology
// Anything else, including the HTML home page, is served as is.

interface Context {
  request: Request
  next: () => Promise<Response>
  env: { ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> } }
}

const ontologyPath = '/index.ttl'
const turtle = 'text/turtle'

export const onRequest = async ({ request, next, env }: Context): Promise<Response> => {
  const url = new URL(request.url)
  const localName = url.pathname === '/' ? '' : url.pathname.match(/^\/([A-Za-z][\w-]*)$/)?.[1]
  if (localName === undefined || !['GET', 'HEAD'].includes(request.method)) return next()

  const wantsTurtle = quality(request.headers.get('Accept'), turtle) > quality(request.headers.get('Accept'), 'text/html')
  if (!localName && !wantsTurtle) return next()

  const ontology = await env.ASSETS.fetch(new URL(ontologyPath, url))
  const text = await ontology.text()
  // pretty-turtle writes every term as a prefixed name, st:GeoEditor.
  if (localName && !new RegExp(`(^|\\s)st:${localName}(\\s|$)`, 'm').test(text)) return next()

  if (!wantsTurtle) {
    return Response.redirect(new URL(`/documentation/ontology#${localName}`, url).toString(), 303)
  }

  return new Response(request.method === 'HEAD' ? null : text, {
    headers: {
      'Content-Type': `${turtle}; charset=utf-8`,
      'Content-Location': ontologyPath,
      'Access-Control-Allow-Origin': '*',
      Vary: 'Accept'
    }
  })
}

// The q-value the Accept header gives a media type, through its most specific matching range
// (type/subtype, then type/*, then */*). No Accept header means anything is acceptable.
const quality = (accept: string | null, mediaType: string): number => {
  if (!accept) return mediaType === 'text/html' ? 1 : 0
  const [type] = mediaType.split('/')
  let best: { specificity: number; q: number } = { specificity: -1, q: 0 }
  for (const part of accept.split(',')) {
    const [range, ...params] = part.trim().toLowerCase().split(';')
    const specificity = range === mediaType ? 2 : range === `${type}/*` ? 1 : range === '*/*' ? 0 : -1
    if (specificity <= best.specificity) continue
    const q = params.map(param => param.trim().match(/^q=([\d.]+)$/)?.[1]).find(Boolean)
    best = { specificity, q: q === undefined ? 1 : Number(q) }
  }
  return best.q
}
