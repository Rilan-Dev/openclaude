import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import processShim from './shims/process.js'
import { Buffer as BrowserBuffer } from './shims/nodeBuiltins.js'
import type { Props as REPLPropsType } from '../src/screens/REPL.js'
import { getRuntimeRenderMode, isBrowserRuntime } from '../src/utils/imports.js'

const existingProcess = globalThis.process as
  | (typeof processShim & { env?: Record<string, string> })
  | undefined

globalThis.process = {
  ...processShim,
  ...(existingProcess ?? {}),
  env: {
    ...(processShim.env ?? {}),
    ...(existingProcess?.env ?? {}),
  },
}

if (!globalThis.Buffer) {
  globalThis.Buffer = BrowserBuffer
}

if (!('global' in globalThis)) {
  ;(globalThis as typeof globalThis & { global: typeof globalThis }).global =
    globalThis
}

const replProps: REPLPropsType = {
  commands: [],
  debug: false,
  initialTools: [],
  renderMode: getRuntimeRenderMode('web'),
  thinkingConfig: {
    type: 'adaptive'
  }
}

async function main() {
  const [{ App }, { AppStateProvider }, { REPL }] = await Promise.all([
    import('../src/components/App.js'),
    import('../src/state/AppState.js'),
    import('../src/screens/REPL.js')
  ])

  const root = ReactDOM.createRoot(document.getElementById('root')!)
  root.render(
    <React.StrictMode>
      <AppStateProvider>
        <App getFpsMetrics={() => undefined} renderMode={replProps.renderMode}>
          <REPL {...replProps} />
        </App>
      </AppStateProvider>
    </React.StrictMode>
  )

  if (isBrowserRuntime()) {
    // Keep the mounted app reachable from the browser window for inspection and lifecycle hooks.
    ;(globalThis as typeof globalThis & {
      __OPENCLAUDE_APP__?: {
        renderMode: REPLPropsType['renderMode']
        root: typeof root
      }
    }).__OPENCLAUDE_APP__ = {
      renderMode: replProps.renderMode,
      root,
    }
  }
}

main()
