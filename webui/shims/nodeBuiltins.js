import { deflateSync as fflateDeflateSync } from 'fflate'

const NativeTextEncoder = globalThis.TextEncoder
const NativeTextDecoder = globalThis.TextDecoder

const unavailable = name => {
  throw new Error(`${name} is not available in the browser web UI`)
}

export function c(size) {
  return new Array(size).fill(Symbol.for('react.memo_cache_sentinel'))
}

const enoent = path => {
  const error = new Error(`ENOENT: no such file or directory, open '${path}'`)
  error.code = 'ENOENT'
  error.errno = -2
  error.path = path
  return error
}

export function openSync(path) {
  throw enoent(path)
}

export function closeSync() {}

export function fsyncSync() {}

export function readSync() {
  return 0
}

export function rmdirSync() {}

export function linkSync() {}

export async function readlink(path) {
  throw enoent(path)
}

export function readlinkSync(path) {
  throw enoent(path)
}

export let defaultMaxListeners = 10

export function setMaxListeners(_n, ..._eventTargets) {}

export function getMaxListeners(_eventTarget) {
  return defaultMaxListeners
}

export async function cp() {}

export async function rmdir() {}

export async function open(path) {
  throw enoent(path)
}

export class EventEmitter {
  constructor() {
    this._listeners = new Map()
    this._maxListeners = defaultMaxListeners
  }

  setMaxListeners(n) {
    this._maxListeners = n
    return this
  }

  getMaxListeners() {
    return this._maxListeners
  }

  on(event, listener) {
    const listeners = this._listeners.get(event) ?? []
    listeners.push(listener)
    this._listeners.set(event, listeners)
    return this
  }

  addListener(event, listener) {
    return this.on(event, listener)
  }

  once(event, listener) {
    const wrapper = (...args) => {
      this.removeListener(event, wrapper)
      listener(...args)
    }
    return this.on(event, wrapper)
  }

  off(event, listener) {
    return this.removeListener(event, listener)
  }

  removeListener(event, listener) {
    const listeners = this._listeners.get(event)
    if (!listeners) return this
    this._listeners.set(
      event,
      listeners.filter(current => current !== listener),
    )
    return this
  }

  removeAllListeners(event) {
    if (event === undefined) {
      this._listeners.clear()
    } else {
      this._listeners.delete(event)
    }
    return this
  }

  emit(event, ...args) {
    const listeners = this._listeners.get(event) ?? []
    for (const listener of [...listeners]) {
      listener(...args)
    }
    return listeners.length > 0
  }
}

export class AsyncLocalStorage {
  constructor() {
    this.store = undefined
  }

  run(store, callback, ...args) {
    const previous = this.store
    this.store = store
    try {
      return callback(...args)
    } finally {
      this.store = previous
    }
  }

  getStore() {
    return this.store
  }

  enterWith(store) {
    this.store = store
  }

  disable() {
    this.store = undefined
  }
}

const textEncoder = new NativeTextEncoder()
const textDecoder = new NativeTextDecoder()

export class Buffer extends Uint8Array {
  static from(input, encoding = 'utf8') {
    if (input instanceof ArrayBuffer) {
      return new Buffer(input)
    }
    if (ArrayBuffer.isView(input)) {
      return new Buffer(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength))
    }
    if (Array.isArray(input)) {
      return new Buffer(input)
    }
    if (typeof input === 'string') {
      if (encoding === 'base64') {
        const binary = atob(input)
        return new Buffer([...binary].map(char => char.charCodeAt(0)))
      }
      return new Buffer(textEncoder.encode(input))
    }
    return new Buffer(0)
  }

  static alloc(size, fill = 0) {
    const buffer = new Buffer(size)
    buffer.fill(fill)
    return buffer
  }

  static isBuffer(value) {
    return value instanceof Buffer
  }

  toString(encoding = 'utf8') {
    if (encoding === 'hex') {
      return [...this].map(byte => byte.toString(16).padStart(2, '0')).join('')
    }
    if (encoding === 'base64') {
      let binary = ''
      for (const byte of this) binary += String.fromCharCode(byte)
      return btoa(binary)
    }
    return textDecoder.decode(this)
  }
}

export const Blob = globalThis.Blob
export const File = globalThis.File
export const resolveObjectURL = () => undefined

function browserRandomBytes(size) {
  const bytes = new Uint8Array(size)
  globalThis.crypto?.getRandomValues?.(bytes)
  return Buffer.from(bytes)
}

export function randomUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = browserRandomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function randomBytes(size) {
  return browserRandomBytes(size)
}

export function randomFillSync(buffer) {
  globalThis.crypto?.getRandomValues?.(buffer)
  return buffer
}

export function randomInt(min, max, callback) {
  if (max === undefined) {
    max = min
    min = 0
  }
  const value = Math.floor(Math.random() * (max - min)) + min
  if (typeof callback === 'function') {
    queueMicrotask(() => callback(null, value))
    return undefined
  }
  return value
}

export const webcrypto = globalThis.crypto

export const TextEncoder = NativeTextEncoder
export const TextDecoder = NativeTextDecoder

export function createHash() {
  const chunks = []
  return {
    update(value) {
      chunks.push(typeof value === 'string' ? value : Buffer.from(value).toString())
      return this
    },
    digest(encoding = 'hex') {
      const input = chunks.join('')
      let hash = 2166136261
      for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
      }
      const hex = (hash >>> 0).toString(16).padStart(8, '0').repeat(8)
      if (encoding === 'hex') return hex
      if (encoding === 'base64') return Buffer.from(hex).toString('base64')
      return Buffer.from(hex)
    },
  }
}

export function createHmac() {
  return createHash()
}

export function createCipheriv() {
  unavailable('crypto.createCipheriv')
}

export function createDecipheriv() {
  unavailable('crypto.createDecipheriv')
}

export function createPrivateKey() {
  unavailable('crypto.createPrivateKey')
}

export function createPublicKey() {
  unavailable('crypto.createPublicKey')
}

export function sign() {
  unavailable('crypto.sign')
}

export function verify() {
  unavailable('crypto.verify')
}

export function createSecretKey() {
  unavailable('crypto.createSecretKey')
}

const normalizeParts = parts => {
  const joined = parts
    .filter(part => part !== undefined && part !== null && part !== '')
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
  const absolute = joined.startsWith('/')
  const segments = []
  for (const segment of joined.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      segments.pop()
    } else {
      segments.push(segment)
    }
  }
  return `${absolute ? '/' : ''}${segments.join('/')}` || (absolute ? '/' : '.')
}

export function join(...parts) {
  return normalizeParts(parts)
}

export function resolve(...parts) {
  return normalizeParts(parts)
}

export function normalize(path) {
  return normalizeParts([path])
}

export function dirname(path) {
  const normalized = normalize(path)
  const index = normalized.lastIndexOf('/')
  if (index <= 0) return normalized.startsWith('/') ? '/' : '.'
  return normalized.slice(0, index)
}

export function basename(path, ext = '') {
  const name = normalize(path).split('/').pop() ?? ''
  return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name
}

export function extname(path) {
  const name = basename(path)
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(index) : ''
}

export function isAbsolute(path) {
  return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)
}

export function relative(from, to) {
  const fromParts = normalize(from).split('/').filter(Boolean)
  const toParts = normalize(to).split('/').filter(Boolean)
  while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
    fromParts.shift()
    toParts.shift()
  }
  return [...fromParts.map(() => '..'), ...toParts].join('/') || ''
}

export function parse(path) {
  const dir = dirname(path)
  const base = basename(path)
  const ext = extname(base)
  return {
    root: isAbsolute(path) ? '/' : '',
    dir,
    base,
    ext,
    name: ext ? base.slice(0, -ext.length) : base,
  }
}

export function formatPathObject(pathObject) {
  return join(pathObject.dir ?? pathObject.root ?? '', pathObject.base ?? `${pathObject.name ?? ''}${pathObject.ext ?? ''}`)
}

export const sep = '/'
export const delimiter = ':'
export const posix = { join, resolve, normalize, dirname, basename, extname, isAbsolute, relative, parse, format: formatPathObject, sep, delimiter }
export const win32 = posix

export function homedir() {
  return '/'
}

export function tmpdir() {
  return '/tmp'
}

export function platform() {
  return 'browser'
}

export function type() {
  return 'Browser'
}

export function version() {
  return ''
}

export function release() {
  return ''
}

export function arch() {
  return 'browser'
}

export function cpus() {
  return []
}

export function userInfo() {
  return { username: 'browser', homedir: '/', shell: null }
}

export function hostname() {
  return 'localhost'
}

export const EOL = '\n'

export async function readFile(path) {
  throw enoent(path)
}

export async function writeFile() {}
export async function appendFile() {}
export async function mkdir() {}
export async function chmod() {}
export async function copyFile() {}
export async function link() {}
export async function truncate() {}
export async function symlink() {}
export async function rename() {}
export async function rm() {}
export async function unlink() {}
export async function utimes() {}
export async function readdir() {
  return []
}
export async function mkdtemp(prefix = '/tmp/openclaude-') {
  return `${prefix}${Math.random().toString(16).slice(2)}`
}
export async function stat() {
  return fileStat
}
export async function lstat() {
  return fileStat
}
export async function realpath(path) {
  return path
}
export async function access() {}

const fileStat = {
  isFile: () => false,
  isDirectory: () => false,
  isSymbolicLink: () => false,
  size: 0,
  mtimeMs: 0,
}

export function readFileSync(path) {
  throw enoent(path)
}

export function writeFileSync() {}
export function appendFileSync() {}
export function mkdirSync() {}
export function chmodSync() {}
export function copyFileSync() {}
export function symlinkSync() {}
export function renameSync() {}
export function rmSync() {}
export function unlinkSync() {}
export function existsSync() {
  return false
}
export function realpathSync(path) {
  return path
}
realpathSync.native = realpathSync
export function statSync() {
  return fileStat
}
export function lstatSync() {
  return fileStat
}
export function readdirSync() {
  return []
}
export function createReadStream() {
  return new Readable()
}
export function createWriteStream() {
  return new Writable()
}
export function watchFile(_filename, _options, _listener) {}
export function unwatchFile(_filename, _listener) {}
export function watch(_filename, _options, _listener) {
  return new EventEmitter()
}
export function accessSync() {}
export function fstatSync() {
  return fileStat
}
export function fstat(fd, callback) {
  if (typeof callback === 'function') queueMicrotask(() => callback(null, fileStat))
}
export function mkdtempSync(prefix = '/tmp/openclaude-') {
  return `${prefix}${Math.random().toString(16).slice(2)}`
}
export function writeSync(fd, stringOrBuffer, ...args) {
  return typeof stringOrBuffer === 'string' ? Buffer.byteLength(stringOrBuffer) : stringOrBuffer.byteLength ?? stringOrBuffer.length ?? 0
}
export const constants = {
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1,
  O_RDONLY: 0,
  O_WRONLY: 1,
  O_RDWR: 2,
  O_CREAT: 512,
  O_EXCL: 2048,
  O_NOFOLLOW: 256,
  O_NONBLOCK: 4,
  O_APPEND: 8,
}

export const promises = {
  readFile,
  writeFile,
  appendFile,
  mkdir,
  chmod,
  copyFile,
  cp,
  symlink,
  link,
  rename,
  rmdir,
  rm,
  unlink,
  utimes,
  readdir,
  readlink,
  mkdtemp,
  stat,
  lstat,
  realpath,
  access,
  open,
}

const createProcessResult = () => ({
  status: 1,
  signal: null,
  stdout: '',
  stderr: 'Node child processes are not available in the browser web UI',
  error: new Error('Node child processes are not available in the browser web UI'),
})

export function spawn() {
  const proc = new EventEmitter()
  proc.stdin = new Writable()
  proc.stdout = new Readable()
  proc.stderr = new Readable()
  proc.kill = () => false
  queueMicrotask(() => proc.emit('error', new Error('Node child processes are not available in the browser web UI')))
  return proc
}

export function spawnSync() {
  return createProcessResult()
}

export function exec(_command, callback) {
  const proc = spawn()
  if (typeof callback === 'function') {
    queueMicrotask(() => callback(createProcessResult().error, '', createProcessResult().stderr))
  }
  return proc
}

export function execFile(_file, _args, _options, callback) {
  const proc = spawn()
  const cb = typeof _args === 'function' ? _args : typeof _options === 'function' ? _options : callback
  if (typeof cb === 'function') {
    queueMicrotask(() => cb(createProcessResult().error, '', createProcessResult().stderr))
  }
  return proc
}

export function execFileSync() {
  unavailable('child_process.execFileSync')
}

export function execSync() {
  unavailable('child_process.execSync')
}

export function fork() {
  return spawn()
}

export function lookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback
  if (typeof cb === 'function') queueMicrotask(() => cb(null, hostname, 4))
  return Promise.resolve({ address: hostname, family: 4 })
}

export function isIP(value) {
  if (/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value)) return 4
  if (typeof value === 'string' && value.includes(':')) return 6
  return 0
}

export function connect() {
  unavailable('network sockets')
}

export function createServer() {
  unavailable('network servers')
}

export function createConnection() {
  unavailable('network sockets')
}

export const rootCertificates = []
export function getCACertificates() {
  return []
}
export function createSecureContext() {
  return {}
}

export class Stream extends EventEmitter {}

export class Readable extends Stream {
  pipe(destination) {
    return destination
  }
  read() {
    return null
  }
  push() {
    return false
  }
  static from(iterable) {
    const stream = new Readable()
    stream.iterable = iterable
    return stream
  }
}

export class Writable extends Stream {
  write(_chunk, _encoding, callback) {
    if (typeof _encoding === 'function') _encoding()
    if (typeof callback === 'function') callback()
    return true
  }
  end(_chunk, _encoding, callback) {
    if (typeof _encoding === 'function') _encoding()
    if (typeof callback === 'function') callback()
    this.emit('finish')
  }
}

export class Duplex extends Readable {
  write() {
    return true
  }
  end() {}
}

export class Transform extends Duplex {}
export class PassThrough extends Transform {}

export function pipeline(...args) {
  const callback = args.find(arg => typeof arg === 'function')
  if (callback) callback()
  return args[args.length - 2]
}

export function finished(_stream, callback) {
  if (typeof callback === 'function') queueMicrotask(callback)
}

export function isReadable() {
  return false
}

export function isErrored() {
  return false
}

export function createGunzip() {
  return new Transform()
}

export function createGzip() {
  return new Transform()
}

export function createInflate() {
  return new Transform()
}

export function createDeflate() {
  return new Transform()
}

export class Agent {}
export const globalAgent = new Agent()
export function request() {
  unavailable('http.request')
}
export function get() {
  unavailable('http.get')
}

export const performance = globalThis.performance ?? {
  now: () => Date.now(),
}

export function format(formatValue, ...args) {
  if (typeof formatValue !== 'string') {
    return [formatValue, ...args].map(String).join(' ')
  }
  let index = 0
  return formatValue.replace(/%[sdjoO%]/g, token => {
    if (token === '%%') return '%'
    const value = args[index++]
    if (token === '%j' || token === '%o' || token === '%O') {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    return String(value)
  })
}

export function inspect(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function promisify(fn) {
  return (...args) =>
    new Promise((resolvePromise, reject) => {
      fn(...args, (error, value) => {
        if (error) reject(error)
        else resolvePromise(value)
      })
    })
}

export function stripVTControlCharacters(value) {
  return String(value).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
}

export function debuglog() {
  return () => {}
}

export const types = {
  isAnyArrayBuffer: value => value instanceof ArrayBuffer,
  isArrayBufferView: ArrayBuffer.isView,
  isUint8Array: value => value instanceof Uint8Array,
}

export function fileURLToPath(value) {
  const url = value instanceof URL ? value : new URL(String(value))
  return decodeURIComponent(url.pathname)
}

export function pathToFileURL(value) {
  return new URL(`file://${isAbsolute(value) ? value : `/${value}`}`)
}

export const URL = globalThis.URL
export const URLSearchParams = globalThis.URLSearchParams

export class DatabaseSync {
  constructor() {
    unavailable('node:sqlite')
  }
}

export function getHeapSnapshot() {
  unavailable('v8.getHeapSnapshot')
}

export function getHeapStatistics() {
  return {
    total_heap_size: 0,
    total_heap_size_executable: 0,
    total_physical_size: 0,
    total_available_size: 0,
    used_heap_size: 0,
    heap_size_limit: 0,
    malloced_memory: 0,
    peak_malloced_memory: 0,
    does_zap_garbage: 0,
    number_of_native_contexts: 0,
    number_of_detached_contexts: 0,
    total_global_handles_size: 0,
    used_global_handles_size: 0,
    external_memory: 0,
  }
}

export function getHeapSpaceStatistics() {
  return []
}

export function deflateSync(value) {
  return Buffer.from(fflateDeflateSync(value))
}

export function writeHeapSnapshot() {
  unavailable('v8.writeHeapSnapshot')
}

export default {
  Agent,
  AsyncLocalStorage,
  Blob,
  Buffer,
  DatabaseSync,
  Duplex,
  EOL,
  EventEmitter,
  File,
  PassThrough,
  Readable,
  Stream,
  Transform,
  URL,
  URLSearchParams,
  Writable,
  arch,
  basename,
  connect,
  cpus,
  createServer,
  createConnection,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  createReadStream,
  createWriteStream,
  createSecretKey,
  deflateSync,
  delimiter,
  dirname,
  existsSync,
  extname,
  fileURLToPath,
  format,
  get,
  globalAgent,
  homedir,
  inspect,
  isAbsolute,
  isIP,
  join,
  getHeapSnapshot,
  getHeapStatistics,
  getHeapSpaceStatistics,
  lookup,
  normalize,
  parse,
  pathToFileURL,
  performance,
  platform,
  posix,
  promises,
  randomBytes,
  randomFillSync,
  randomInt,
  randomUUID,
  readFile,
  readFileSync,
  readdir,
  readdirSync,
  relative,
  release,
  request,
  resolve,
  sep,
  spawn,
  spawnSync,
  stat,
  statSync,
  execSync,
  sign,
  stripVTControlCharacters,
  tmpdir,
  type,
  version,
  userInfo,
  webcrypto,
  win32,
  verify,
  writeFile,
  writeFileSync,
  readFile,
  readFileSync,
  readlink,
  readlinkSync,
  readdir,
  readdirSync,
  defaultMaxListeners,
  getMaxListeners,
  setMaxListeners,
  copyFile,
  copyFileSync,
  cp,
  mkdir,
  open,
  rmdir,
  rm,
  closeSync,
  linkSync,
  openSync,
  readSync,
  rmdirSync,
  fsyncSync,
  watch,
  watchFile,
  unwatchFile,
  accessSync,
  link,
  fstatSync,
  fstat,
  mkdtempSync,
  writeSync,
  constants,
}
