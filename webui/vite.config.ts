import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import {
  browserAliasesFromRootPackage,
  openClaudeCompatPlugin,
} from './vite.openclaude-compat'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

function resolveBackendOrigin() {
  const explicit = process.env.VITE_BACKEND_ORIGIN
  if (explicit) return explicit

  try {
    const gateway = execSync("ip route | awk '/default/ {print $3; exit}'", {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (gateway) return `http://${gateway}:3000`
  } catch {
    // Windows/local fallback.
  }

  return 'http://localhost:3000'
}

const backendOrigin = resolveBackendOrigin()
const browserAliases = browserAliasesFromRootPackage()

export default defineConfig({
  plugins: [
    openClaudeCompatPlugin(),
    react(),
  ],

  define: {
    'MACRO.VERSION': JSON.stringify('99.0.0'),
    'MACRO.DISPLAY_VERSION': JSON.stringify('0.19.0'),
    'MACRO.BUILD_TIME': JSON.stringify(new Date().toISOString()),
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
    alias: {
      ...browserAliases,

      // Root OpenClaude source alias.
      '@': path.resolve(repoRoot, 'src'),

      // Optional separate alias for webui-local imports.
      '@web': path.resolve(__dirname, 'src'),
    },
  },

  optimizeDeps: {
    exclude: [
      ...Object.keys(browserAliases),
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
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      '/api': { target: backendOrigin, changeOrigin: true },
      '/socket.io': { target: backendOrigin, ws: true },
    },
  },
})
