export const URL = globalThis.URL
export const URLSearchParams = globalThis.URLSearchParams

export function fileURLToPath(value) {
  const url = value instanceof URL ? value : new URL(String(value))
  return decodeURIComponent(url.pathname)
}

export function pathToFileURL(value) {
  const path = String(value).replace(/\\/g, '/')
  return new URL(`file://${path.startsWith('/') ? path : `/${path}`}`)
}

export function parse(value) {
  const url = new URL(value)
  return {
    protocol: url.protocol,
    slashes: true,
    auth: url.username
      ? `${url.username}${url.password ? `:${url.password}` : ''}`
      : null,
    host: url.host,
    port: url.port,
    hostname: url.hostname,
    hash: url.hash,
    search: url.search,
    query: url.search.startsWith('?') ? url.search.slice(1) : url.search,
    pathname: url.pathname,
    path: `${url.pathname}${url.search}`,
    href: url.href,
  }
}

export default {
  URL,
  URLSearchParams,
  fileURLToPath,
  parse,
  pathToFileURL,
}
