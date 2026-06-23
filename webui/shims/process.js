export const env = {}
export const argv = []
export const execArgv = []
export const version = ''
export const versions = {}
export const platform = 'browser'
export const arch = 'browser'
export const pid = 0
export const title = 'browser'
export const stdin = undefined
export const stdout = undefined
export const stderr = undefined

export function cwd() {
  return '/'
}

export function chdir() {}

export function exit(code = 0) {
  throw new Error(`process.exit(${code}) is not available in the browser web UI`)
}

export function nextTick(callback, ...args) {
  queueMicrotask(() => callback(...args))
}

export function uptime() {
  return performance.now() / 1000
}

export function memoryUsage() {
  return {
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0,
    arrayBuffers: 0,
  }
}

export function resourceUsage() {
  return {
    maxRSS: 0,
    userCPUTime: 0,
    systemCPUTime: 0,
  }
}

export function on() {
  return process
}

export function once() {
  return process
}

export function off() {
  return process
}

export function removeListener() {
  return process
}

export const process = {
  arch,
  argv,
  chdir,
  cwd,
  env,
  execArgv,
  exit,
  memoryUsage,
  nextTick,
  off,
  on,
  once,
  pid,
  platform,
  removeListener,
  resourceUsage,
  stderr,
  stdin,
  stdout,
  title,
  uptime,
  version,
  versions,
}

export default process
