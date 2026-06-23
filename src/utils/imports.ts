
import * as browserBuiltins from '../../webui/shims/nodeBuiltins.js'

export type UUID = string

export type HttpIncomingMessage = {
  headers: Record<string, string | string[] | undefined>
  method?: string
  url?: string
}

export type HttpServerResponse = {
  destroyed?: boolean
  headersSent?: boolean
  statusCode: number
  writableEnded?: boolean
  end(body?: string): void
  setHeader(name: string, value: string): void
  writeHead(statusCode: number, headers?: Record<string, string>): void
}

export type HttpServer = {
  address(): unknown
  close(callback?: () => void): void
  listen(
    port?: number,
    hostOrCallback?: string | (() => void),
    callback?: () => void,
  ): void
  on(event: string, listener: (...args: any[]) => void): void
  once(event: string, listener: (...args: any[]) => void): void
  removeAllListeners(event?: string): void
  removeListener(event: string, listener: (...args: any[]) => void): void
  unref?(): void
}

export type AsyncContextStorage<T> = {
  run: <R>(context: T, fn: () => R) => R
  getStore: () => T | undefined
}

export const WINDOWS_PATH_SEPARATOR = '\\'
export const POSIX_PATH_SEPARATOR = '/'

type RuntimeRequireFn = <T>(id: string) => T
const browserPathModule = browserBuiltins as typeof import('path')
const browserOsModule = browserBuiltins as typeof import('os')
const isBrowserRuntime =
  typeof window !== 'undefined' && typeof document !== 'undefined'

function getRuntimeRequire(): RuntimeRequireFn {
  return (0, eval)('require') as RuntimeRequireFn
}

function getPathModule(): typeof import('path') {
  return isBrowserRuntime
    ? browserPathModule
    : runtimeRequire<typeof import('path')>('path')
}

function getOsModule(): typeof import('os') {
  return isBrowserRuntime
    ? browserOsModule
    : runtimeRequire<typeof import('os')>('os')
}

function getFsPromisesModule(): typeof import('fs/promises') {
  return isBrowserRuntime
    ? (browserBuiltins as typeof import('fs/promises'))
    : runtimeRequire<typeof import('fs/promises')>('fs/promises')
}

function getChildProcessModule(): typeof import('child_process') {
  return isBrowserRuntime
    ? (browserBuiltins as typeof import('child_process'))
    : runtimeRequire<typeof import('child_process')>('child_process')
}

export function runtimeRequire<T>(id: string): T {
  return getRuntimeRequire()(id)
}

export async function runtimeImport<T>(id: string): Promise<T> {
  return (await import(id)) as T
}

export function createAsyncContextStorage<T>(): AsyncContextStorage<T> {
  try {
    const { AsyncLocalStorage } = runtimeRequire<{
      AsyncLocalStorage: new () => AsyncContextStorage<T>
    }>('async_hooks')
    return new AsyncLocalStorage()
  } catch {
    let current: T | undefined
    return {
      run<R>(context: T, fn: () => R): R {
        const previous = current
        current = context
        try {
          return fn()
        } finally {
          current = previous
        }
      },
      getStore(): T | undefined {
        return current
      },
    }
  }
}

export async function createHttpServer(
  handler?: (req: HttpIncomingMessage, res: HttpServerResponse) => void,
): Promise<HttpServer> {
  const httpPackage = ['ht', 'tp'].join('')
  const { createServer } = await runtimeImport<{
    createServer: (listener?: typeof handler) => HttpServer
  }>(httpPackage)
  return createServer(handler)
}

export async function createStdioServerTransport<T = unknown>(): Promise<T> {
  const stdioPackage = ['@modelcontextprotocol', 'sdk/server/stdio.js'].join('/')
  const { StdioServerTransport } = await runtimeImport<{
    StdioServerTransport: new () => T
  }>(stdioPackage)
  return new StdioServerTransport()
}

export function pathToFileURL(path: string): URL {
  const normalized = path.replace(/\\/g, '/')
  const pathname = normalized.startsWith('/') ? normalized : `/${normalized}`
  return new URL(`file://${encodeURI(pathname).replace(/#/g, '%23')}`)
}

export function fileURLToPath(value: string | URL): string {
  const url = value instanceof URL ? value : new URL(value)
  return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/, '$1')
}

export function stripVTControlCharacters(value: string): string {
  return String(value).replace(
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    '',
  )
}

export function randomUUID(): UUID {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return runtimeRequire<{ randomUUID: () => string }>('crypto').randomUUID()
}

export function randomInt(max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    throw new RangeError('max must be a positive finite number')
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const limit = Math.floor(0x100000000 / max) * max
    const value = new Uint32Array(1)
    let random = 0
    do {
      globalThis.crypto.getRandomValues(value)
      random = value[0] ?? 0
    } while (random >= limit)
    return random % max
  }

  return runtimeRequire<{ randomInt: (range: number) => number }>(
    'crypto',
  ).randomInt(max)
}

export function randomBytes(size: number) {
  if (isBrowserRuntime) {
    return browserBuiltins.randomBytes(size)
  }
  return runtimeRequire<typeof import('crypto')>('crypto').randomBytes(size)
}

export function deflateSync(data: Uint8Array) {
  if (isBrowserRuntime) {
    return browserBuiltins.deflateSync(data)
  }
  return runtimeRequire<typeof import('zlib')>('zlib').deflateSync(data)
}

export function dirname(path: string): string {
  return getPathModule().dirname(path)
}

export function basename(path: string): string {
  return getPathModule().basename(path)
}

export function join(...parts: string[]): string {
  return getPathModule().join(...parts)
}

export function resolve(...parts: string[]): string {
  return getPathModule().resolve(...parts)
}

export function relative(from: string, to: string): string {
  return getPathModule().relative(from, to)
}

export function normalize(path: string): string {
  return getPathModule().normalize(path)
}

export function isAbsolute(path: string): boolean {
  return getPathModule().isAbsolute(path)
}

export function extname(path: string): string {
  return getPathModule().extname(path)
}

export const posix = getPathModule().posix
export const win32 = getPathModule().win32
export const sep = getPathModule().sep
export const delimiter = getPathModule().delimiter

export function pathDelimiter(): string {
  return delimiter
}

export function pathSeparator(): string {
  return sep
}

export function homedir(): string {
  return getOsModule().homedir()
}

export function tmpdir(): string {
  return getOsModule().tmpdir()
}

export function platform(): NodeJS.Platform {
  return getOsModule().platform()
}

export function type(): string {
  return getOsModule().type()
}

export function version(): string {
  return getOsModule().version()
}

export function release(): string {
  return getOsModule().release()
}

export async function readFile(
  path: string,
  options?: { encoding?: BufferEncoding },
): Promise<string | Buffer> {
  return getFsPromisesModule().readFile(path, options)
}

export async function mkdir(
  path: string,
  options?: {
    recursive?: boolean
  },
): Promise<void> {
  await getFsPromisesModule().mkdir(path, options)
}

export async function copyFile(path: string, destination: string): Promise<void> {
  await getFsPromisesModule().copyFile(path, destination)
}

export async function writeFile(path: string, data: string): Promise<void> {
  await getFsPromisesModule().writeFile(path, data)
}

export function spawnSync(
  command: string,
  args: string[],
  options?: {
    cwd?: string
    encoding?: BufferEncoding
    env?: NodeJS.ProcessEnv
    stdio?: 'ignore' | 'inherit' | 'pipe'
    timeout?: number
  },
): {
  error?: Error
  status: number | null
  stdout?: string
  stderr?: string
} {
  return getChildProcessModule().spawnSync(command, args, options)
}

export function exec(
  command: string,
  options: {
    timeout?: number
  },
): {
  on: (event: 'exit', listener: (code: number | null) => void) => void
} {
  return getChildProcessModule().exec(command, options)
}

export function getExeca(): typeof import('execa').execa {
  return runtimeRequire<typeof import('execa')>('execa').execa
}
