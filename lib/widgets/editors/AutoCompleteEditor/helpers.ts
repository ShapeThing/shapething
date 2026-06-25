import { ProxyHandlerStatic } from '@comunica/actor-http-proxy'
import { Store } from '@rdfjs/types'
import { needsHttpProxy } from '../../../core/needsHttpProxy'
import { cachedFetch } from '../../../helpers/cachedFetch'
export const corsProxy = 'https://corsproxy.io/?'
const localCachedFetch = cachedFetch()

export const sparqlQuery = async (source: string | Store, query: string) => {
  const termNeedsProxy =
    source && typeof source === 'string' && !source.includes('/sparql')
      ? await needsHttpProxy(source, localCachedFetch)
      : false

  try {
    const { QueryEngine } = await import('@comunica/query-sparql')
    const queryEngine = new QueryEngine()
    const quadsStream = await queryEngine.queryQuads(query, {
      sources: [source],
      lenient: true,
      unionDefaultGraph: true,
      httpProxyHandler: termNeedsProxy ? new ProxyHandlerStatic(corsProxy) : undefined
    })
    return await quadsStream.toArray()
  } catch (error) {
    console.error('Error in sparqlQuery:', error)
    throw error
  }
}
