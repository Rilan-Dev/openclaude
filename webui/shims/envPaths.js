export default function envPaths(name) {
  const safeName = String(name || 'openclaude')
  const base = `/browser/${safeName}`
  return {
    cache: `${base}/cache`,
    config: `${base}/config`,
    data: `${base}/data`,
    log: `${base}/log`,
    temp: `${base}/temp`,
  }
}
