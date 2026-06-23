import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import processShim from './shims/process.js'
import { Buffer as BrowserBuffer } from './shims/nodeBuiltins.js'
import type { Props as REPLPropsType } from '../src/screens/REPL.js'

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

const replProps: REPLPropsType = {
  commands: [],
  debug: false,
  initialTools: [],
  renderMode: 'web',
  thinkingConfig: {
    type: 'adaptive'
  }
}

async function main() {
  const [{ App }, { REPL }] = await Promise.all([
    import('../src/components/App.js'),
    import('../src/screens/REPL.js')
  ])

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App
        getFpsMetrics={() => undefined}
        renderMode="web"
      >
        <REPL {...replProps} />
      </App>
    </React.StrictMode>
  )
}

main()
