import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const webuiRoot = __dirname
const repoRoot = path.resolve(webuiRoot, '..')
const rootSrc = path.resolve(repoRoot, 'src')
const webuiSrc = path.resolve(webuiRoot, 'src')

const OPTIONAL_PREFIX = '\0openclaude-optional:'
const TEXT_PREFIX = '\0openclaude-text:'
const MISSING_RELATIVE_PREFIX = '\0openclaude-missing-relative:'
const MISSING_MODULE_PREFIX = '\0openclaude-missing-module:'

const featureFlags: Record<string, boolean> = {
  VOICE_MODE: false,
  PROACTIVE: false,
  KAIROS: false,
  BRIDGE_MODE: false,
  DAEMON: false,
  AGENT_TRIGGERS: false,
  ABLATION_BASELINE: false,
  CONTEXT_COLLAPSE: true,
  COMMIT_ATTRIBUTION: false,
  HISTORY_SNIP: true,
  UDS_INBOX: false,
  BG_SESSIONS: true,
  WEB_BROWSER_TOOL: false,
  CHICAGO_MCP: false,
  COWORKER_TYPE_TELEMETRY: false,
  MCP_SKILLS: true,

  COORDINATOR_MODE: true,
  BUILTIN_EXPLORE_PLAN_AGENTS: true,
  BUDDY: true,
  MONITOR_TOOL: true,
  TEAMMEM: true,
  MESSAGE_ACTIONS: true,

  DUMP_SYSTEM_PROMPT: true,
  CACHED_MICROCOMPACT: true,
  AWAY_SUMMARY: true,
  TRANSCRIPT_CLASSIFIER: true,
  ULTRATHINK: true,
  TOKEN_BUDGET: true,
  HISTORY_PICKER: true,
  QUICK_SEARCH: true,
  SHOT_STATS: true,
  EXTRACT_MEMORIES: true,
  FORK_SUBAGENT: true,
  RESUME_COMPACT_PROMPT: true,
  VERIFICATION_AGENT: true,
  PROMPT_CACHE_BREAK_DETECTION: true,
  HOOK_PROMPTS: true,
}

const featureCallRe = /\bfeature\(\s*['"](\w+)['"][,\s]*\)/gs
const featureImportRe =
  /import\s*\{[^}]*\bfeature\b[^}]*\}\s*from\s*['"]bun:bundle['"];?\s*\n?/g

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function encodeJson(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value))
}

function decodeJson<T>(value: string): T {
  return JSON.parse(decodeURIComponent(value)) as T
}

function tryResolveFile(absPath: string): string | null {
  const candidates = [
    absPath,
    absPath.replace(/\.js$/, '.ts'),
    absPath.replace(/\.js$/, '.tsx'),
    absPath.replace(/\.jsx$/, '.tsx'),
    `${absPath}.ts`,
    `${absPath}.tsx`,
    `${absPath}.js`,
    `${absPath}.jsx`,
    path.join(absPath, 'index.ts'),
    path.join(absPath, 'index.tsx'),
    path.join(absPath, 'index.js'),
    path.join(absPath, 'index.jsx'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  return null
}

function toRelativeImport(fromFile: string, targetFile: string): string {
  let rel = path.relative(path.dirname(fromFile), targetFile).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = `./${rel}`
  return rel
}

function rewriteBrowserMappedImports(
  code: string,
  importerFile: string,
  browserAliases: Record<string, string>,
): string {
  let out = code

  for (const [specifier, targetFile] of Object.entries(browserAliases)) {
    const replacement = toRelativeImport(importerFile, targetFile)
    const escaped = escapeRegex(specifier)

    out = out.replace(
      new RegExp(`((?:from\\s*|import\\s*\\(\\s*)['"])${escaped}(['"])`, 'g'),
      (_m, before, after) => `${before}${replacement}${after}`,
    )

    out = out.replace(
      new RegExp(`(\\bimport\\s*['"])${escaped}(['"])`, 'g'),
      (_m, before, after) => `${before}${replacement}${after}`,
    )
  }

  return out
}

function readOptionalDeclaredModules(): Set<string> {
  const modules = new Set<string>()
  const file = path.resolve(repoRoot, 'src/optionalModules.d.ts')

  if (!fs.existsSync(file)) return modules

  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(/declare\s+module\s+['"]([^'"]+)['"]/g)) {
    modules.add(match[1])
  }

  return modules
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ent.name === 'node_modules' ||
      ent.name === 'dist' ||
      ent.name === '.vite'
    ) {
      continue
    }

    const full = path.join(dir, ent.name)

    if (ent.isDirectory()) {
      walkFiles(full, out)
    } else if (/\.(ts|tsx|js|jsx)$/.test(ent.name)) {
      out.push(full)
    }
  }

  return out
}

function stripCommentsForImportScan(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

function moduleKey(specifier: string): string {
  return `module:${specifier}`
}

function relativeKey(importer: string, specifier: string): string {
  return `relative:${normalizePath(importer)}::${specifier}`
}

function registerNames(
  map: Map<string, Set<string>>,
  key: string,
  namedPart: string,
): void {
  if (!namedPart.trim()) return

  const rawNames = namedPart
    .split(',')
    .map(s => s.trim().replace(/^type\s+/, ''))
    .filter(Boolean)

  if (rawNames.length === 0) return
  if (!map.has(key)) map.set(key, new Set())

  const names = map.get(key)!

  for (const raw of rawNames) {
    const originalName = raw.split(/\s+as\s+/)[0]?.trim()
    if (originalName && /^[A-Za-z_$][\w$]*$/.test(originalName)) {
      names.add(originalName)
    }
  }
}

function scanNamedImports(optionalModules: Set<string>): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  const files = [...walkFiles(rootSrc), ...walkFiles(webuiSrc)]

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8')
    const code = stripCommentsForImportScan(raw)

    for (const m of code.matchAll(
      /import\s+(?:type\s+)?(?:\{([^}]*)\}|([\w$]+))?\s*(?:,\s*\{([^}]*)\})?\s*from\s+['"]([^'"]+)['"]/g,
    )) {
      const specifier = m[4]
      const namedPart = m[1] || m[3] || ''

      if (optionalModules.has(specifier)) {
        registerNames(result, moduleKey(specifier), namedPart)
      }

      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        registerNames(result, relativeKey(file, specifier), namedPart)
      }

      if (specifier.startsWith('@/tasks/')) {
        registerNames(result, moduleKey(specifier), namedPart)
      }
    }

    for (const m of code.matchAll(
      /export\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g,
    )) {
      const namedPart = m[1]
      const specifier = m[2]

      if (optionalModules.has(specifier)) {
        registerNames(result, moduleKey(specifier), namedPart)
      }

      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        registerNames(result, relativeKey(file, specifier), namedPart)
      }

      if (specifier.startsWith('@/tasks/')) {
        registerNames(result, moduleKey(specifier), namedPart)
      }
    }
  }

  return result
}

function makeGenericStub(moduleName: string, names: Set<string>): string {
  if (moduleName === 'bun:bundle') {
    return `
export function feature(_name) {
  return false
}
`
  }

  if (moduleName === 'plist') {
    return `
export function parse(_input) {
  return {}
}

export default {
  parse,
}
`
  }

  if (moduleName === 'cacache') {
    return `
export const ls = {
  stream(_path) {
    return {
      async *[Symbol.asyncIterator]() {}
    }
  }
}

export const rm = {
  async entry(_path, _key) {}
}

export default {
  ls,
  rm,
}
`
  }

  if (
    moduleName === 'react/compiler-runtime' ||
    moduleName === 'react-compiler-runtime'
  ) {
    return `
export function c(size) {
  return new Array(size).fill(Symbol.for('react.memo_cache_sentinel'))
}

export default {
  c,
}
`
  }

  const overrides: Record<string, string> = {
    BROWSER_TOOLS: '[]',
    ColorDiff: 'null',
    ColorFile: 'null',
    SandboxViolationStore: 'null',
    SandboxManager:
      'class { static isSupportedPlatform() { return false } static create() { return null } }',
    BaseSandboxManager:
      'class { static isSupportedPlatform() { return false } static annotateStderrWithSandboxFailures(_command, stderr) { return stderr } }',
    SandboxRuntimeConfigSchema:
      '{ parse: value => value ?? {}, safeParse: value => ({ success: true, data: value ?? {} }) }',
    McpbManifestSchema:
      '{ parse: value => value ?? {}, safeParse: value => ({ success: true, data: value ?? {} }) }',
    ExportResultCode: '{ SUCCESS: 0, FAILED: 1 }',
    BROWSER_TOOLS_BY_NAME: '{}',
    getMcpConfigForManifest: 'async () => ({})',
    createClaudeForChromeMcpServer: 'async () => null',
    getSyntaxTheme: '() => null',
    plot: '() => ""',
    linkifyUrlsInText: 'value => value',
  }

  const namedExports = [...names]
    .filter(name => name !== 'default')
    .filter(name => /^[A-Za-z_$][\w$]*$/.test(name))
    .map(name => `export const ${name} = ${overrides[name] ?? 'stub'}`)
    .join('\n')

  return `
const noop = (..._args) => null

const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true
    if (prop === 'then') return undefined
    if (prop === Symbol.toStringTag) return 'Module'
    if (prop in target) return target[prop]
    return stub
  },
  apply() {
    return null
  },
  construct() {
    return {}
  },
}

const stub = new Proxy(noop, handler)

export default stub
export const __stub = true
${namedExports}
`
}

export function browserAliasesFromRootPackage(): Record<string, string> {
  const pkgPath = path.resolve(repoRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const browser = pkg.browser ?? {}
  const aliases: Record<string, string> = {}

  for (const [key, value] of Object.entries(browser)) {
    if (typeof value === 'string') {
      aliases[key] = path.resolve(repoRoot, value)
    }
  }

  return aliases
}

function makeOptionalModules(): Set<string> {
  const modules = readOptionalDeclaredModules()

  for (const mod of [
    'bun:bundle',

    'plist',
    'cacache',
    'fuse',
    'asciichart',

    'audio-capture-napi',
    'audio-capture.node',
    'image-processor-napi',
    'modifiers-napi',
    'url-handler-napi',
    'color-diff-napi',

    '@anthropic-ai/mcpb',
    '@ant/claude-for-chrome-mcp',
    '@anthropic-ai/sandbox-runtime',

    '@aws-sdk/client-bedrock',
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-sts',
    '@aws-sdk/credential-provider-ini',
    '@aws-sdk/credential-provider-login',
    '@aws-sdk/credential-provider-node',
    '@aws-sdk/credential-providers',
    '@smithy/core',
    '@smithy/node-http-handler',

    '@ant/computer-use-mcp',
    '@ant/computer-use-mcp/sentinelApps',
    '@ant/computer-use-mcp/types',
    '@ant/computer-use-swift',
    '@ant/computer-use-input',
  ]) {
    modules.add(mod)
  }

  return modules
}

export function openClaudeCompatPlugin(): Plugin {
  const optionalModules = makeOptionalModules()
  const browserAliases = browserAliasesFromRootPackage()
  const namedImports = scanNamedImports(optionalModules)

  return {
    name: 'openclaude-vite-compat',
    enforce: 'pre',

    resolveId(source, importer) {
      if (Object.prototype.hasOwnProperty.call(browserAliases, source)) {
        return browserAliases[source]
      }

      if (source.startsWith('node:')) {
        const withoutNodePrefix = source.slice('node:'.length)
        if (
          Object.prototype.hasOwnProperty.call(
            browserAliases,
            withoutNodePrefix,
          )
        ) {
          return browserAliases[withoutNodePrefix]
        }
      }

      if (source === 'bun:bundle') {
        return `${OPTIONAL_PREFIX}${source}`
      }

      if (optionalModules.has(source)) {
        return `${OPTIONAL_PREFIX}${source}`
      }

      if (/\.(md|txt)$/.test(source)) {
        return `${TEXT_PREFIX}${source}`
      }

      if (source.startsWith('@/')) {
        const resolved = tryResolveFile(path.resolve(rootSrc, source.slice(2)))
        if (resolved) return resolved

        if (source.startsWith('@/tasks/')) {
          return `${MISSING_MODULE_PREFIX}${source}`
        }
      }

      if (source.startsWith('src/')) {
        const resolved = tryResolveFile(path.resolve(repoRoot, source))
        if (resolved) return resolved
      }

      if (
        importer &&
        !importer.startsWith('\0') &&
        (source.startsWith('./') || source.startsWith('../'))
      ) {
        const cleanImporter = importer.split('?')[0]
        const resolved = tryResolveFile(
          path.resolve(path.dirname(cleanImporter), source),
        )

        if (resolved) return resolved

        if (source.endsWith('.js')) {
          return `${MISSING_RELATIVE_PREFIX}${encodeJson({
            importer: normalizePath(cleanImporter),
            source,
          })}`
        }
      }

      return null
    },

    load(id) {
      if (id.startsWith(TEXT_PREFIX)) {
        return `export default ''`
      }

      if (id.startsWith(OPTIONAL_PREFIX)) {
        const moduleName = id.slice(OPTIONAL_PREFIX.length)
        return makeGenericStub(
          moduleName,
          namedImports.get(moduleKey(moduleName)) ?? new Set(),
        )
      }

      if (id.startsWith(MISSING_MODULE_PREFIX)) {
        const moduleName = id.slice(MISSING_MODULE_PREFIX.length)
        return makeGenericStub(
          moduleName,
          namedImports.get(moduleKey(moduleName)) ?? new Set(),
        )
      }

      if (id.startsWith(MISSING_RELATIVE_PREFIX)) {
        const data = decodeJson<{ importer: string; source: string }>(
          id.slice(MISSING_RELATIVE_PREFIX.length),
        )

        return makeGenericStub(
          data.source,
          namedImports.get(relativeKey(data.importer, data.source)) ??
            new Set(),
        )
      }

      return null
    },

    transform(code, id) {
      const cleanId = id.split('?')[0]
      const normalizedId = normalizePath(cleanId)

      const isSource =
        normalizedId.startsWith(normalizePath(rootSrc)) ||
        normalizedId.startsWith(normalizePath(webuiSrc))

      if (!isSource) return null

      let transformed = code

      transformed = rewriteBrowserMappedImports(
        transformed,
        cleanId,
        browserAliases,
      )

      if (transformed.includes('feature(') || transformed.includes('bun:bundle')) {
        transformed = transformed
          .replace(featureImportRe, '')
          .replace(featureCallRe, (_match, name) =>
            String(featureFlags[name] ?? false),
          )
      }

      if (transformed === code) return null

      return {
        code: transformed,
        map: null,
      }
    },
  }
}