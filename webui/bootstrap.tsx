import processShim from './shims/process.js'
import { Buffer as BrowserBuffer } from './shims/nodeBuiltins.js'

globalThis.process = processShim

processShim.updateEnv({
  OPENCLAUDE_RENDER_MODE: 'web',
  CLAUDE_CODE_USE_OPENAI: '1',
  OPENAI_BASE_URL: '/api',
  OPENAI_API_BASE: '/api',
  VITE_BACKEND_ORIGIN: '/api',
})

if (!globalThis.Buffer) {
  globalThis.Buffer = BrowserBuffer
}

if (!('global' in globalThis)) {
  ;(globalThis as typeof globalThis & { global: typeof globalThis }).global =
    globalThis
}

type BootstrapOptions = {
  rootId?: string
}

function installBrowserRequire(): void {
  const browserRequire = (id: string): never => {
    throw new Error(
      `Untransformed require("${id}") reached the browser bundle. ` +
        `The browserRequireToStaticImport() Vite plugin should rewrite ` +
        `literal internal require('./x') calls before runtime.`,
    )
  }

  const globals = globalThis as typeof globalThis & {
    require?: typeof browserRequire
  }

  if (!globals.require) {
    globals.require = browserRequire
  }
}

export async function bootstrapOpenClaudeWebUI(
  options: BootstrapOptions = {},
): Promise<void> {
  installBrowserRequire()

  if (options.rootId) {
    ;(globalThis as typeof globalThis & {
      __OPENCLAUDE_WEB_ROOT_ID__?: string
    }).__OPENCLAUDE_WEB_ROOT_ID__ = options.rootId
  }

  const { main } = await import('../src/main.js')

  await main()
}