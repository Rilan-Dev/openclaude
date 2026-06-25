import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import processShim from './shims/process.js'
import { Buffer as BrowserBuffer } from './shims/nodeBuiltins.js'
import type { Props as REPLPropsType } from '../src/screens/REPL.js'
import { TerminalWriteProvider } from '../src/ink/useTerminalNotification.js'

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
  renderMode: 'web',
  thinkingConfig: {
    type: 'adaptive'
  }
}

const noopWriteRaw = () => {}

async function main() {
  const [{ App }, { AppStateProvider }, { REPL }] = await Promise.all([
    import('../src/components/App.js'),
    import('../src/state/AppState.js'),
    import('../src/screens/REPL.js')
  ])

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <TerminalWriteProvider value={noopWriteRaw}>
      <AppStateProvider>
        <App
          getFpsMetrics={() => undefined}
          renderMode="web"
        >
          <REPL {...replProps} />
        </App>
      </AppStateProvider>
    </TerminalWriteProvider>
  )
}

main()
