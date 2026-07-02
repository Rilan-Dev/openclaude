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

const eexist = path => {
  const error = new Error(`EEXIST: file already exists, open '${path}'`)
  error.code = 'EEXIST'
  error.errno = -17
  error.path = path
  return error
}

const WEBFS_KEY = 'openclaude.webui.fs.v1'
const fdTable = new Map()
let nextFd = 100

const vfsNow = () => Date.now()

const vfsNormalize = path => {
  const raw = String(path ?? '/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
  const absolute = raw.startsWith('/') || /^[a-zA-Z]:\//.test(raw)
  const parts = []
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
    } else {
      parts.push(part)
    }
  }
  return `${absolute ? '/' : '/'}${parts.join('/')}` || '/'
}

const vfsParent = path => {
  const normalized = vfsNormalize(path)
  if (normalized === '/') return '/'
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '/' : normalized.slice(0, index)
}

const loadVfs = () => {
  const fallback = {
    dirs: { '/': { ctimeMs: vfsNow(), mtimeMs: vfsNow() } },
    files: {},
  }
  try {
    const raw = globalThis.localStorage?.getItem(WEBFS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return {
      dirs: { '/': fallback.dirs['/'], ...(parsed.dirs ?? {}) },
      files: parsed.files ?? {},
    }
  } catch {
    return fallback
  }
}

const saveVfs = fs => {
  try {
    globalThis.localStorage?.setItem(WEBFS_KEY, JSON.stringify(fs))
  } catch {
    // Browser storage can be disabled or full. Keep the in-memory operation
    // successful so the UI can continue, matching best-effort terminal logs.
  }
}

const ensureVfsDir = (fs, path) => {
  const dir = vfsNormalize(path)
  if (fs.dirs[dir]) return
  const parent = vfsParent(dir)
  if (parent !== dir) ensureVfsDir(fs, parent)
  const now = vfsNow()
  fs.dirs[dir] = { ctimeMs: now, mtimeMs: now }
}

const toFileString = value => {
  if (typeof value === 'string') return value
  if (value instanceof ArrayBuffer) {
    return new NativeTextDecoder().decode(value)
  }
  if (ArrayBuffer.isView(value)) {
    return new NativeTextDecoder().decode(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    )
  }
  return String(value ?? '')
}

const readVfsText = path => {
  const fs = loadVfs()
  const normalized = vfsNormalize(path)
  const file = fs.files[normalized]
  if (!file) throw enoent(path)
  return file.content ?? ''
}

const makeNodeLikeError = (payload, fallbackPath) => {
  const error = new Error(
    payload?.message ?? `ENOENT: no such file or directory, open '${fallbackPath}'`,
  )
  if (payload?.code) error.code = payload.code
  if (payload?.errno) error.errno = payload.errno
  error.path = payload?.path ?? fallbackPath
  return error
}

const isHostFsPath = path => {
  const value = String(path ?? '')
  return (
    /^[a-zA-Z]:[\\/]/.test(value) ||
    /^\/[a-zA-Z]:[\\/]/.test(value) ||
    /^\\\\[a-zA-Z0-9_$-][^\\]*\\[^\\]+/.test(value) ||
    /^\/\/[a-zA-Z0-9_$-][^/]*\/[^/]+/.test(value)
  )
}

const shouldFallbackToHostFs = (error, path) =>
  error?.code === 'ENOENT' && isHostFsPath(path)

const hostFsRequest = async (op, path, options = undefined) => {
  if (typeof fetch !== 'function') {
    throw enoent(path)
  }

  const response = await fetch('/__openclaude_host_fs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, path, ...(options ? { options } : {}) }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw makeNodeLikeError(payload.error, path)
  }

  return payload
}

const makeHostStat = data => {
  const stats = new Stats(
    {
      ctimeMs: data.ctimeMs,
      mtimeMs: data.mtimeMs,
      birthtimeMs: data.birthtimeMs,
      atimeMs: data.atimeMs,
      size: data.size,
      mode: data.mode,
      isFile: data.isFile,
      isDirectory: data.isDirectory,
      isSymbolicLink: data.isSymbolicLink,
    },
    Boolean(data.isDirectory),
  )
  return stats
}

const makeHostDirent = entry => ({
  name: entry.name,
  isFile: () => Boolean(entry.isFile),
  isDirectory: () => Boolean(entry.isDirectory),
  isSymbolicLink: () => Boolean(entry.isSymbolicLink),
})

const writeVfsText = (path, content, append = false) => {
  const fs = loadVfs()
  const normalized = vfsNormalize(path)
  const parent = vfsParent(normalized)
  ensureVfsDir(fs, parent)
  const now = vfsNow()
  const existing = fs.files[normalized]
  fs.files[normalized] = {
    content: append ? `${existing?.content ?? ''}${content}` : content,
    ctimeMs: existing?.ctimeMs ?? now,
    mtimeMs: now,
  }
  fs.dirs[parent].mtimeMs = now
  saveVfs(fs)
}

const deleteVfsPath = path => {
  const fs = loadVfs()
  const normalized = vfsNormalize(path)
  delete fs.files[normalized]
  for (const dir of Object.keys(fs.dirs)) {
    if (dir !== normalized && dir.startsWith(`${normalized}/`)) {
      delete fs.dirs[dir]
    }
  }
  delete fs.dirs[normalized]
  saveVfs(fs)
}

const renameVfsPath = (oldPath, newPath) => {
  const fs = loadVfs()
  const from = vfsNormalize(oldPath)
  const to = vfsNormalize(newPath)

  if (from === to) {
    return
  }

  const file = fs.files[from]
  const dir = fs.dirs[from]

  if (!file && !dir) {
    throw enoent(oldPath)
  }

  ensureVfsDir(fs, vfsParent(to))

  delete fs.files[to]
  for (const filePath of Object.keys(fs.files)) {
    if (filePath.startsWith(`${to}/`)) {
      delete fs.files[filePath]
    }
  }
  for (const dirPath of Object.keys(fs.dirs)) {
    if (dirPath === to || dirPath.startsWith(`${to}/`)) {
      delete fs.dirs[dirPath]
    }
  }

  if (file) {
    fs.files[to] = {
      ...file,
      mtimeMs: vfsNow(),
    }
    delete fs.files[from]
  } else {
    const movedDirs = []
    const movedFiles = []

    for (const [dirPath, entry] of Object.entries(fs.dirs)) {
      if (dirPath === from || dirPath.startsWith(`${from}/`)) {
        movedDirs.push([dirPath, entry])
      }
    }

    for (const [filePath, entry] of Object.entries(fs.files)) {
      if (filePath.startsWith(`${from}/`)) {
        movedFiles.push([filePath, entry])
      }
    }

    for (const [dirPath] of movedDirs) {
      delete fs.dirs[dirPath]
    }
    for (const [filePath] of movedFiles) {
      delete fs.files[filePath]
    }

    for (const [dirPath, entry] of movedDirs) {
      const targetPath = `${to}${dirPath.slice(from.length)}`
      fs.dirs[targetPath] = {
        ...entry,
        mtimeMs: vfsNow(),
      }
    }
    for (const [filePath, entry] of movedFiles) {
      const targetPath = `${to}${filePath.slice(from.length)}`
      fs.files[targetPath] = {
        ...entry,
        mtimeMs: vfsNow(),
      }
    }
  }

  for (const [fd, path] of fdTable.entries()) {
    if (path === from || path.startsWith(`${from}/`)) {
      fdTable.set(fd, `${to}${path.slice(from.length)}`)
    }
  }

  saveVfs(fs)
}

export class Stats {
  constructor(entry = {}, isDirectory = false) {
    const content = entry?.content ?? ''
    const ctimeMs = entry?.ctimeMs ?? 0
    const mtimeMs = entry?.mtimeMs ?? 0
    this.size =
      typeof entry?.size === 'number'
        ? entry.size
        : isDirectory
          ? 0
          : Buffer.from(content).byteLength
    this.mtime = new Date(mtimeMs)
    this.ctime = new Date(ctimeMs)
    this.birthtime = new Date(entry?.birthtimeMs ?? ctimeMs)
    this.atime = new Date(entry?.atimeMs ?? mtimeMs)
    this.mtimeMs = this.mtime.getTime()
    this.ctimeMs = this.ctime.getTime()
    this.birthtimeMs = this.birthtime.getTime()
    this.atimeMs = this.atime.getTime()
    this.mode =
      typeof entry?.mode === 'number'
        ? entry.mode
        : isDirectory
          ? 0o040755
          : 0o100644
    this.uid = 0
    this.gid = 0
    this.dev = 0
    this.ino = 0
    this.nlink = 1
    this.rdev = 0
    this.blksize = 4096
    this.blocks = Math.ceil(this.size / 512)
    this._isDirectory = isDirectory
    this._isFile =
      typeof entry?.isFile === 'boolean' ? entry.isFile : !isDirectory
    this._isSymbolicLink = Boolean(entry?.isSymbolicLink)
  }

  isFile() {
    return this._isFile
  }

  isDirectory() {
    return this._isDirectory
  }

  isSymbolicLink() {
    return this._isSymbolicLink
  }

  isBlockDevice() {
    return false
  }

  isCharacterDevice() {
    return false
  }

  isFIFO() {
    return false
  }

  isSocket() {
    return false
  }
}

const makeVfsStat = (entry, isDirectory = false) => new Stats(entry, isDirectory)

const getVfsStat = path => {
  const fs = loadVfs()
  const normalized = vfsNormalize(path)
  if (fs.files[normalized]) return makeVfsStat(fs.files[normalized], false)
  if (fs.dirs[normalized]) return makeVfsStat(fs.dirs[normalized], true)
  throw enoent(path)
}

const makeDirent = (name, isDirectory) => ({
  name,
  isFile: () => !isDirectory,
  isDirectory: () => isDirectory,
  isSymbolicLink: () => false,
})

const listVfsDir = (path, options = {}) => {
  const fs = loadVfs()
  const normalized = vfsNormalize(path)
  if (!fs.dirs[normalized]) throw enoent(path)
  const prefix = normalized === '/' ? '/' : `${normalized}/`
  const entries = new Map()
  for (const filePath of Object.keys(fs.files)) {
    if (!filePath.startsWith(prefix)) continue
    const rest = filePath.slice(prefix.length)
    if (!rest || rest.includes('/')) continue
    entries.set(rest, false)
  }
  for (const dirPath of Object.keys(fs.dirs)) {
    if (dirPath === normalized || !dirPath.startsWith(prefix)) continue
    const rest = dirPath.slice(prefix.length)
    if (!rest || rest.includes('/')) continue
    entries.set(rest, true)
  }
  const sorted = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (options?.withFileTypes) {
    return sorted.map(([name, isDirectory]) => makeDirent(name, isDirectory))
  }
  return sorted.map(([name]) => name)
}

const makeFileHandle = path => {
  const normalized = vfsNormalize(path)
  return {
    async read(buffer, offset = 0, length = buffer.byteLength, position = 0) {
      const content = Buffer.from(readVfsText(normalized))
      const start = position ?? 0
      const chunk = content.subarray(start, start + length)
      buffer.set(chunk, offset)
      return { bytesRead: chunk.length, buffer }
    },
    async write(buffer, offset = 0, length, position = 0) {
      const current = Buffer.from(readVfsText(normalized))
      const source =
        typeof buffer === 'string'
          ? Buffer.from(buffer)
          : Buffer.from(buffer).subarray(offset, offset + (length ?? buffer.length))
      const start = position ?? current.length
      const next = Buffer.alloc(Math.max(current.length, start + source.length))
      next.set(current, 0)
      next.set(source, start)
      writeVfsText(normalized, next.toString())
      return { bytesWritten: source.length, buffer }
    },
    async truncate(size = 0) {
      const current = Buffer.from(readVfsText(normalized))
      writeVfsText(normalized, current.subarray(0, size).toString())
    },
    async stat() {
      return getVfsStat(normalized)
    },
    async close() {},
  }
}

const makeHostFileHandle = path => ({
  async read(buffer, offset = 0, length = buffer.byteLength, position = 0) {
    const response = await hostFsRequest('readFile', path)
    const content = Buffer.from(response.data ?? '', response.encoding ?? 'base64')
    const start = position ?? 0
    const chunk = content.subarray(start, start + length)
    buffer.set(chunk, offset)
    return { bytesRead: chunk.length, buffer }
  },
  async write() {
    unavailable('host filesystem writes')
  },
  async truncate() {
    unavailable('host filesystem writes')
  },
  async stat() {
    return makeHostStat(await hostFsRequest('stat', path))
  },
  async close() {},
})

export function openSync(path, flags = 'r') {
  const normalized = vfsNormalize(path)
  const fs = loadVfs()
  const flagText = String(flags ?? 'r')
  const exists = Boolean(fs.files[normalized])

  if (flagText.includes('x') && exists) {
    throw eexist(path)
  }

  if (!exists) {
    if (
      flagText.includes('w') ||
      flagText.includes('a') ||
      flagText.includes('+')
    ) {
      writeVfsText(normalized, '')
    } else {
      throw enoent(path)
    }
  } else if (flagText.startsWith('w')) {
    writeVfsText(normalized, '')
  }

  const fd = nextFd++
  fdTable.set(fd, normalized)
  return fd
}

export function closeSync(fd) {
  fdTable.delete(fd)
}

export function fsyncSync() {}

export function readSync(fd, buffer, offset = 0, length = buffer.byteLength, position = 0) {
  const path = fdTable.get(fd)
  if (!path) throw enoent(String(fd))
  const content = Buffer.from(readVfsText(path))
  const chunk = content.subarray(position ?? 0, (position ?? 0) + length)
  buffer.set(chunk, offset)
  return chunk.length
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

export async function* glob() {}

export async function open(path, flags = 'r') {
  const normalized = vfsNormalize(path)
  if (!loadVfs().files[normalized]) {
    if (String(flags).includes('w') || String(flags).includes('+')) {
      writeVfsText(normalized, '')
    } else if (!isHostFsPath(path)) {
      throw enoent(path)
    } else {
      return makeHostFileHandle(path)
    }
  }
  return makeFileHandle(normalized)
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
    wrapper.listener = listener
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

  listeners(event) {
    return (this._listeners.get(event) ?? []).map(listener => listener.listener ?? listener)
  }

  rawListeners(event) {
    return [...(this._listeners.get(event) ?? [])]
  }

  listenerCount(event) {
    return this._listeners.get(event)?.length ?? 0
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

  static allocUnsafe(size) {
    return new Buffer(size)
  }

  static isBuffer(value) {
    return value instanceof Buffer
  }

  static byteLength(value, encoding = 'utf8') {
    return Buffer.from(value, encoding).byteLength
  }

  toString(encoding = 'utf8', start = 0, end = this.byteLength) {
    const view = this.subarray(start, end)
    if (encoding === 'hex') {
      return [...view].map(byte => byte.toString(16).padStart(2, '0')).join('')
    }
    if (encoding === 'base64') {
      let binary = ''
      for (const byte of view) binary += String.fromCharCode(byte)
      return btoa(binary)
    }
    return textDecoder.decode(view)
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

export function createInterface() {
  return {
    question(_query, callback) {
      if (typeof callback === 'function') {
        callback('')
      }
    },
    close() {},
    on() {
      return this
    },
    once() {
      return this
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
  return 'linux'
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
  return 'x64'
}

export function cpus() {
  return []
}

export function totalmem() {
  return 8 * 1024 * 1024 * 1024
}

export function freemem() {
  return 4 * 1024 * 1024 * 1024
}

export function userInfo() {
  return { username: 'browser', homedir: '/', shell: null }
}

export function hostname() {
  return 'localhost'
}

export const EOL = '\n'

export async function readFile(path, options) {
  const encoding = typeof options === 'string' ? options : options?.encoding
  try {
    const content = readVfsText(path)
    return encoding ? content : Buffer.from(content)
  } catch (error) {
    if (!shouldFallbackToHostFs(error, path)) {
      throw error
    }

    const response = await hostFsRequest('readFile', path, {
      encoding: encoding ?? null,
    })
    return response.encoding === 'base64'
      ? Buffer.from(response.data ?? '', 'base64')
      : response.data ?? ''
  }
}

export async function writeFile(path, data) {
  writeVfsText(path, toFileString(data))
}
export async function appendFile(path, data) {
  writeVfsText(path, toFileString(data), true)
}
export async function mkdir(path) {
  const fs = loadVfs()
  ensureVfsDir(fs, path)
  saveVfs(fs)
}
export async function chmod() {}
export async function copyFile() {}
export async function link() {}
export async function truncate() {}
export async function symlink() {}
export async function rename(oldPath, newPath) {
  renameVfsPath(oldPath, newPath)
}
export async function rm(path) {
  deleteVfsPath(path)
}
export async function unlink(path) {
  deleteVfsPath(path)
}
export async function utimes() {}
export async function readdir(path, options) {
  try {
    return listVfsDir(path, options)
  } catch (error) {
    if (!shouldFallbackToHostFs(error, path)) {
      throw error
    }

    const response = await hostFsRequest('readdir', path, {
      withFileTypes: Boolean(options?.withFileTypes),
    })
    return options?.withFileTypes ? response.map(makeHostDirent) : response
  }
}
export async function mkdtemp(prefix = '/tmp/openclaude-') {
  return `${prefix}${Math.random().toString(16).slice(2)}`
}
export async function stat(path) {
  try {
    return getVfsStat(path)
  } catch (error) {
    if (!shouldFallbackToHostFs(error, path)) {
      throw error
    }

    return makeHostStat(await hostFsRequest('stat', path))
  }
}
export async function lstat(path) {
  try {
    return getVfsStat(path)
  } catch (error) {
    if (!shouldFallbackToHostFs(error, path)) {
      throw error
    }

    return makeHostStat(await hostFsRequest('lstat', path))
  }
}
export async function realpath(path) {
  try {
    getVfsStat(path)
    return path
  } catch (error) {
    if (!shouldFallbackToHostFs(error, path)) {
      throw error
    }

    return (await hostFsRequest('realpath', path)).path
  }
}
export async function access(path) {
  try {
    getVfsStat(path)
  } catch (error) {
    if (!shouldFallbackToHostFs(error, path)) {
      throw error
    }

    await hostFsRequest('access', path)
  }
}

const fileStat = {
  isFile: () => false,
  isDirectory: () => false,
  isSymbolicLink: () => false,
  size: 0,
  mtimeMs: 0,
}

export function readFileSync(path, options) {
  const content = readVfsText(path)
  const encoding = typeof options === 'string' ? options : options?.encoding
  return encoding ? content : Buffer.from(content)
}

export function writeFileSync(path, data) {
  if (typeof path === 'number') {
    const fdPath = fdTable.get(path)
    if (!fdPath) throw enoent(String(path))
    writeVfsText(fdPath, toFileString(data))
    return
  }
  writeVfsText(path, toFileString(data))
}
export function appendFileSync(path, data) {
  if (typeof path === 'number') {
    const fdPath = fdTable.get(path)
    if (!fdPath) throw enoent(String(path))
    writeVfsText(fdPath, toFileString(data), true)
    return
  }
  writeVfsText(path, toFileString(data), true)
}
export function mkdirSync(path) {
  const fs = loadVfs()
  ensureVfsDir(fs, path)
  saveVfs(fs)
}
export function chmodSync() {}
export function copyFileSync() {}
export function symlinkSync() {}
export function renameSync(oldPath, newPath) {
  renameVfsPath(oldPath, newPath)
}
export function rmSync(path) {
  deleteVfsPath(path)
}
export function unlinkSync(path) {
  deleteVfsPath(path)
}
export function existsSync(path) {
  const fs = loadVfs()
  const normalized = vfsNormalize(path)
  return Boolean(fs.files[normalized] || fs.dirs[normalized])
}
export function realpathSync(path) {
  return path
}
realpathSync.native = realpathSync
export function statSync(path) {
  return getVfsStat(path)
}
export function lstatSync(path) {
  return getVfsStat(path)
}
export function readdirSync(path, options) {
  return listVfsDir(path, options)
}
export function createReadStream() {
  return new ReadStream()
}
export function createWriteStream() {
  return new WriteStream()
}
export function watchFile(_filename, _options, _listener) {}
export function unwatchFile(_filename, _listener) {}
export function watch(_filename, _options, _listener) {
  const watcher = new EventEmitter()
  watcher.close = () => {
    watcher.removeAllListeners()
  }
  watcher.ref = () => watcher
  watcher.unref = () => watcher
  return watcher
}
export function accessSync() {}
export function fstatSync(fd) {
  const path = fdTable.get(fd)
  if (!path) throw enoent(String(fd))
  return getVfsStat(path)
}
export function fstat(fd, callback) {
  if (typeof callback === 'function') {
    queueMicrotask(() => {
      try {
        callback(null, fstatSync(fd))
      } catch (error) {
        callback(error)
      }
    })
  }
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

export class ReadStream extends Readable {
  constructor(fd) {
    super()
    this.fd = fd
    this.isTTY = false
  }

  setRawMode() {
    return this
  }

  resume() {
    return this
  }

  pause() {
    return this
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

export class WriteStream extends Writable {
  constructor(fd) {
    super()
    this.fd = fd
    this.isTTY = false
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
  ReadStream,
  Stats,
  Stream,
  Transform,
  URL,
  URLSearchParams,
  Writable,
  WriteStream,
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
  totalmem,
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
