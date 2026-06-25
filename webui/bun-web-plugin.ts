import { plugin } from 'bun'
import { join, resolve } from 'node:path'

const isWebUiBuild = process.argv.some(arg =>
  /(?:^|[\\/])webui[\\/]+index\.html$/i.test(arg),
)

function normalizeSpecifier(specifier: string): string {
  return specifier.replace(/^node:/, '')
}

if (isWebUiBuild) {
  const shimDir = join(import.meta.dir, 'shims')
  const repoRoot = resolve(import.meta.dir, '..')
  const reactDir = join(repoRoot, 'node_modules', 'react')
  const reactDomDir = join(repoRoot, 'node_modules', 'react-dom')

  const resolveShim = (fileName: string): string => join(shimDir, fileName)
  const resolveReact = (fileName: string): string => join(reactDir, fileName)
  const resolveReactDom = (fileName: string): string =>
    join(reactDomDir, fileName)

  const builtinShims: Record<string, string> = {
    assert: 'nodeBuiltins.js',
    buffer: 'nodeBuiltins.js',
    child_process: 'nodeBuiltins.js',
    crypto: 'nodeBuiltins.js',
    dns: 'nodeBuiltins.js',
    events: 'nodeBuiltins.js',
    fs: 'nodeBuiltins.js',
    'fs/promises': 'nodeBuiltins.js',
    http: 'nodeBuiltins.js',
    https: 'nodeBuiltins.js',
    net: 'nodeBuiltins.js',
    os: 'nodeBuiltins.js',
    path: 'nodeBuiltins.js',
    'path/win32': 'nodeBuiltins.js',
    perf_hooks: 'nodeBuiltins.js',
    process: 'process.js',
    querystring: 'nodeBuiltins.js',
    readline: 'nodeBuiltins.js',
    stream: 'nodeBuiltins.js',
    'stream/promises': 'nodeBuiltins.js',
    'stream/web': 'nodeBuiltins.js',
    tls: 'nodeBuiltins.js',
    tty: 'nodeBuiltins.js',
    url: 'url.js',
    util: 'nodeBuiltins.js',
    'util/types': 'nodeBuiltins.js',
    v8: 'nodeBuiltins.js',
    worker_threads: 'nodeBuiltins.js',
    zlib: 'nodeBuiltins.js',
    sqlite: 'nodeBuiltins.js',
  }

  const reactShims: Record<string, string> = {
    react: 'index.js',
    'react/jsx-runtime': 'jsx-runtime.js',
    'react/jsx-dev-runtime': 'jsx-dev-runtime.js',
    'react/compiler-runtime': 'compiler-runtime.js',
    'react-compiler-runtime': 'compiler-runtime.js',
    'react-dom': 'index.js',
    'react-dom/client': 'client.js',
    'react-dom/server': 'server.browser.js',
    'react-dom/server.browser': 'server.browser.js',
    'react-dom/server.node': 'server.node.js',
    'react-dom/test-utils': 'test-utils.js',
  }

  const optionalPackageShims: Record<string, string> = {
    '@ant/claude-for-chrome-mcp': 'optionalPackages.js',
    '@anthropic-ai/client': 'optionalPackages.js',
    '@anthropic-ai/mcpb': 'optionalPackages.js',
    '@anthropic-ai/sandbox-runtime': 'sandboxRuntime.js',
    '@aws-sdk/client-bedrock': 'optionalPackages.js',
    '@aws-sdk/client-bedrock-runtime': 'optionalPackages.js',
    '@aws-sdk/client-sts': 'optionalPackages.js',
    '@aws-sdk/credential-provider-ini': 'optionalPackages.js',
    '@aws-sdk/credential-provider-login': 'optionalPackages.js',
    '@aws-sdk/credential-provider-node': 'optionalPackages.js',
    '@aws-sdk/credential-providers': 'optionalPackages.js',
    '@smithy/core': 'optionalPackages.js',
    '@smithy/node-http-handler': 'optionalPackages.js',
    asciichart: 'optionalPackages.js',
    'fetch-blob/from.js': 'fetchBlob.js',
    'node-fetch': 'nodeFetch.js',
    undici: 'undici.js',
    'vscode-jsonrpc/node.js': 'optionalPackages.js',
  }

  plugin({
    name: 'openclaude-webui-shims',
    setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        const specifier = normalizeSpecifier(args.path)
        const reactShim = reactShims[specifier]
        if (reactShim) {
          if (specifier.startsWith('react-dom')) {
            return { path: resolveReactDom(reactShim) }
          }
          return { path: resolveReact(reactShim) }
        }

        const optionalShim = optionalPackageShims[specifier]
        if (optionalShim) {
          return { path: resolveShim(optionalShim) }
        }

        const builtinShim = builtinShims[specifier]
        if (builtinShim) {
          return { path: resolveShim(builtinShim) }
        }

        return undefined
      })
    },
  })
}
