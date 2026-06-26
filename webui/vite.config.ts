import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { isBrowserRuntime } from '../src/utils/imports'
import {
  browserAliasesFromRootPackage,
  openClaudeCompatPlugin,
} from './vite.openclaude-compat'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const webuiRoot = __dirname
const repoRoot = path.resolve(__dirname, '..')

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

  return {
    plugins: [
      openClaudeCompatPlugin(),
      react(),
    ],

    define: {
      //
      // expose ALL env variables
      //
      __OPENCLAUDE_ENV__: JSON.stringify(env),

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
      alias: {
        ...browserAliases,

        '@': path.resolve(repoRoot, 'src'),

        '@web': path.resolve(__dirname, 'src'),

        'react-dom-client-browser': path.join(
          webuiRoot,
          'node_modules/react-dom/cjs/react-dom-client.development.js',
        ),
      },
    },

    optimizeDeps: {
      include: ['react', 'react-dom-client-browser'],
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
    },

    server: {
      port: 5175,
      host: '0.0.0.0',
      fs: {
        allow: [repoRoot],
      },
      proxy: {
        '/api': { target: backendOrigin, changeOrigin: true },
        '/socket.io': { target: backendOrigin, ws: true },
      },
    },
  }
})
