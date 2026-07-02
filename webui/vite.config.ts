import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { isBrowserRuntime } from '../src/utils/imports'
import {
  browserAliasesFromRootPackage,
  openClaudeCompatPlugin,
} from './vite.openclaude-compat'
import { browserRequireToStaticImport } from '../scripts/browserRequireToStaticImport'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

async function readJsonBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  const body = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

  if (body.length === 0) {
    return {}
  }

  return JSON.parse(body.toString('utf8'))
}

function sendJson(
  res: import('node:http').ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

function serializeFsError(error: unknown, fallbackPath?: string): {
  message: string
  code?: string
  path?: string
} {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException
    return {
      message: nodeError.message,
      ...(nodeError.code ? { code: nodeError.code } : {}),
      ...(typeof nodeError.path === 'string'
        ? { path: nodeError.path }
        : fallbackPath
          ? { path: fallbackPath }
          : {}),
    }
  }

  return {
    message: String(error),
    ...(fallbackPath ? { path: fallbackPath } : {}),
  }
}

function normalizeHostFsPath(fsPath: string): string {
  const trimmed = fsPath.trim()
  const withoutLeadingDriveSlash = trimmed.replace(
    /^\/([a-zA-Z]:)(?=\/|\\)/,
    '$1',
  )

  if (process.platform === 'win32') {
    return withoutLeadingDriveSlash.replaceAll('/', '\\')
  }

  return withoutLeadingDriveSlash
}

function hostFsPlugin(): Plugin {
  return {
    name: 'openclaude-host-fs-readonly',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ?? ''
        if (!requestUrl.startsWith('/__openclaude_host_fs')) {
          next()
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: { message: 'Method not allowed' } })
          return
        }

        try {
          const body = (await readJsonBody(req)) as {
            op?: string
            path?: string
            options?: { encoding?: BufferEncoding | null; withFileTypes?: boolean }
          }
          const rawFsPath = body.path
          if (!body.op || typeof rawFsPath !== 'string' || rawFsPath.length === 0) {
            sendJson(res, 400, { error: { message: 'Invalid host fs request' } })
            return
          }
          const fsPath = normalizeHostFsPath(rawFsPath)

          if (body.op === 'readFile') {
            const buffer = await fs.readFile(fsPath)
            const encoding = body.options?.encoding
            sendJson(res, 200, {
              data:
                encoding && encoding !== null
                  ? buffer.toString(encoding)
                  : buffer.toString('base64'),
              encoding: encoding && encoding !== null ? encoding : 'base64',
            })
            return
          }

          if (body.op === 'stat' || body.op === 'lstat') {
            const stats = body.op === 'stat' ? await fs.stat(fsPath) : await fs.lstat(fsPath)
            sendJson(res, 200, {
              size: stats.size,
              mode: stats.mode,
              mtimeMs: stats.mtimeMs,
              ctimeMs: stats.ctimeMs,
              birthtimeMs: stats.birthtimeMs,
              atimeMs: stats.atimeMs,
              isFile: stats.isFile(),
              isDirectory: stats.isDirectory(),
              isSymbolicLink: stats.isSymbolicLink(),
            })
            return
          }

          if (body.op === 'readdir') {
            const entries = await fs.readdir(fsPath, {
              withFileTypes: Boolean(body.options?.withFileTypes),
            })
            sendJson(
              res,
              200,
              Boolean(body.options?.withFileTypes)
                ? entries.map(entry => ({
                    name: entry.name,
                    isFile: entry.isFile(),
                    isDirectory: entry.isDirectory(),
                    isSymbolicLink: entry.isSymbolicLink(),
                  }))
                : entries,
            )
            return
          }

          if (body.op === 'realpath') {
            sendJson(res, 200, { path: await fs.realpath(fsPath) })
            return
          }

          if (body.op === 'access') {
            await fs.access(fsPath)
            sendJson(res, 200, { ok: true })
            return
          }

          sendJson(res, 400, { error: { message: `Unsupported host fs op: ${body.op}` } })
        } catch (error) {
          const serialized = serializeFsError(error)
          sendJson(res, serialized.code === 'ENOENT' ? 404 : 500, {
            error: serialized,
          })
        }
      })
    },
  }
}

function dynamicProviderProxyPlugin(): Plugin {
  return {
    name: 'openclaude-dynamic-provider-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ?? ''
        if (!requestUrl.startsWith('/__openclaude_provider')) {
          next()
          return
        }

        try {
          const parsed = new URL(requestUrl, 'http://openclaude.local')
          const targetRaw = parsed.searchParams.get('url')
          if (!targetRaw) {
            res.statusCode = 400
            res.end('Missing provider target URL')
            return
          }

          const target = new URL(targetRaw)
          if (target.protocol !== 'https:' && target.protocol !== 'http:') {
            res.statusCode = 400
            res.end('Unsupported provider target protocol')
            return
          }

          const body =
            req.method && ['GET', 'HEAD'].includes(req.method)
              ? undefined
              : await new Promise<Buffer>((resolve, reject) => {
                  const chunks: Buffer[] = []
                  req.on('data', chunk => chunks.push(Buffer.from(chunk)))
                  req.on('end', () => resolve(Buffer.concat(chunks)))
                  req.on('error', reject)
                })

          const headers = new Headers()
          for (const [name, value] of Object.entries(req.headers)) {
            if (
              value === undefined ||
              [
                'connection',
                'content-length',
                'host',
                'origin',
                'referer',
              ].includes(name.toLowerCase())
            ) {
              continue
            }

            if (Array.isArray(value)) {
              for (const item of value) {
                headers.append(name, item)
              }
            } else {
              headers.set(name, value)
            }
          }
          headers.set('origin', target.origin)
          headers.set('referer', `${target.origin}/`)

          const upstream = await fetch(target, {
            method: req.method,
            headers,
            body,
          })

          res.statusCode = upstream.status
          res.statusMessage = upstream.statusText
          upstream.headers.forEach((value, name) => {
            if (
              [
                'connection',
                'content-encoding',
                'content-length',
                'transfer-encoding',
              ].includes(name.toLowerCase())
            ) {
              return
            }
            res.setHeader(name, value)
          })

          if (!upstream.body) {
            res.end()
            return
          }

          for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
            res.write(Buffer.from(chunk))
          }
          res.end()
        } catch (error) {
          res.statusCode = 502
          res.end(
            error instanceof Error
              ? `Provider proxy failed: ${error.message}`
              : 'Provider proxy failed',
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  //
  // THIS IS THE IMPORTANT PART
  //
  const loadedEnv = loadEnv(mode, repoRoot, '')

  const runtimeEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
  const env = {
    ...loadedEnv,
    ...runtimeEnv,
  }
  const browserEnv = { ...env }

  for (const key of [
    'CLAUDE_CODE_USE_OPENAI',
    'CLAUDE_CODE_USE_GEMINI',
    'CLAUDE_CODE_USE_MISTRAL',
    'CLAUDE_CODE_USE_GITHUB',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
    'OPENAI_BASE_URL',
    'OPENAI_API_BASE',
    'OPENAI_MODEL',
    'OPENAI_API_FORMAT',
    'OPENAI_AUTH_HEADER',
    'OPENAI_AUTH_SCHEME',
    'OPENAI_AUTH_HEADER_VALUE',
    'CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED',
    'CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID',
    'VITE_BACKEND_ORIGIN',
  ]) {
    delete browserEnv[key]
  }

  // merge loaded env into process.env
  Object.assign(process.env, env)

  function resolveBackendOrigin() {
    const explicit = process.env.VITE_BACKEND_ORIGIN
    if (explicit) return explicit

    try {
      const gateway = execSync("ip route | awk '/default/ {print $3; exit}'", {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()

      if (gateway) return `http://${gateway}:3000`
    } catch {}

    return 'http://localhost:3000'
  }

  const backendOrigin = resolveBackendOrigin()

  const browserAliases = browserAliasesFromRootPackage()
  const excludedBrowserAliases = Object.keys(browserAliases)
  const browserAliasEntries = Object.entries(browserAliases)
    .sort(([a], [b]) => b.length - a.length)
    .map(([find, replacement]) => ({
      find,
      replacement,
    }))

  return {
    plugins: [
          browserRequireToStaticImport(),
          openClaudeCompatPlugin(),
          hostFsPlugin(),
          dynamicProviderProxyPlugin(),
          react(),
    ],

    define: {
      //
      // expose ALL env variables
      //
      __OPENCLAUDE_ENV__: JSON.stringify(browserEnv),

      'MACRO.VERSION': JSON.stringify('99.0.0'),
      'MACRO.DISPLAY_VERSION': JSON.stringify('0.19.0'),
      'MACRO.BUILD_TIME': JSON.stringify(new Date().toISOString()),

      'process.env.OPENCLAUDE_RENDER_MODE': JSON.stringify(
        process.env.OPENCLAUDE_RENDER_MODE ?? 'web',
      ),

      'MACRO.ISSUES_EXPLAINER': JSON.stringify(
        'report the issue at https://github.com/Gitlawb/openclaude/issues',
      ),

      'MACRO.FEEDBACK_CHANNEL': JSON.stringify(
        'https://github.com/Gitlawb/openclaude/issues',
      ),

      'MACRO.PACKAGE_URL': JSON.stringify('@gitlawb/openclaude'),
      'MACRO.NATIVE_PACKAGE_URL': 'undefined',
      'MACRO.VERSION_CHANGELOG': 'undefined',
    },

    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        ...browserAliasEntries,
        {
          find: '@',
          replacement: path.resolve(repoRoot, 'src'),
        },
        {
          find: '@web',
          replacement: path.resolve(__dirname, 'src'),
        },
      ],
    },

    optimizeDeps: {
      exclude: [
        ...excludedBrowserAliases,
        'bun:bundle',
        'plist',
        'cacache',
        'fuse',
        'asciichart',
        '@anthropic-ai/mcpb',
        '@ant/claude-for-chrome-mcp',
        '@anthropic-ai/sandbox-runtime',
      ],
      esbuildOptions: {
        plugins: [
        ],
      },
    },

    server: {
      port: 5175,
      host: '0.0.0.0',
      fs: {
        allow: [repoRoot],
      },
      proxy: {
        '/api/responses': {
          target: backendOrigin,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, ''),
        },
        '/api/chat/completions': {
          target: backendOrigin,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, ''),
        },
        '/api': { target: backendOrigin, changeOrigin: true },
        '/socket.io': { target: backendOrigin, ws: true },
      },
    },
  }
})
