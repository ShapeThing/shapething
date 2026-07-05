export const needsHttpProxy = async (url: string, fetch?: (typeof globalThis)['fetch']) => {
  const key = `needs-http-proxy:${url}`
  const cached = sessionStorage.getItem(key)
  if (cached !== null) return !!parseInt(cached)

  let needsProxy = false
  try {
    await (fetch ?? globalThis['fetch'])(url)
    sessionStorage.setItem(key, '0')
  } catch {
    sessionStorage.setItem(key, '1')
    needsProxy = true
  }
  return needsProxy
}
