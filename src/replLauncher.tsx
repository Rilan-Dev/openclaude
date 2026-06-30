import React from 'react'
import type { StatsStore } from './context/stats.js'
import type { Root } from './ink.js'
import type { Props as REPLProps } from './screens/REPL.js'
import type { AppState } from './state/AppStateStore.js'
import type { FpsMetrics } from './utils/fpsTracker.js'

type BrowserRoot = {
  render: (node: React.ReactNode) => void
  unmount: () => void
}

type BrowserGlobals = typeof globalThis & {
  __openclaudeWebUiRoot?: BrowserRoot
}

type AppWrapperProps = {
  getFpsMetrics: () => FpsMetrics | undefined
  stats?: StatsStore
  initialState?: AppState
  renderMode?: 'terminal' | 'web'
  onChangeAppState?: (args: {
    newState: AppState
    oldState: AppState
  }) => void
}

function createLoadingScreen() {
  return React.createElement(
    'div',
    {
      style: {
        alignItems: 'center',
        background:
          'radial-gradient(circle at top left, rgba(65, 89, 141, 0.22), transparent 34rem), linear-gradient(135deg, #0b1117 0%, #11181f 44%, #16110d 100%)',
        color: '#f3eadc',
        display: 'grid',
        fontFamily: '"IBM Plex Sans", "Aptos", "Segoe UI", sans-serif',
        minHeight: '100vh',
        padding: '32px',
      },
    },
    React.createElement(
      'div',
      { style: { maxWidth: 720 } },
      React.createElement(
        'div',
        {
          style: {
            color: '#86efac',
            fontSize: 12,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          },
        },
        'OpenClaude web',
      ),
      React.createElement(
        'h1',
        { style: { fontSize: 34, lineHeight: 1.1, margin: '10px 0 12px' } },
        'Bootstrapping browser runtime',
      ),
      React.createElement(
        'p',
        {
          style: {
            color: '#cbd5e1',
            fontSize: 16,
            margin: 0,
          },
        },
        'Loading the shared REPL modules and provider bridge.',
      ),
    ),
  )
}

export async function launchRepl(
  terminalRoot: Root,
  appProps: AppWrapperProps,
  replProps: REPLProps,
  renderAndRun: (
    root: Root,
    element: React.ReactNode,
  ) => Promise<void>,
): Promise<void> {
  const { onChangeAppState, ...appPropsForApp } = appProps

  if (appProps.renderMode === 'web') {
    const { createRoot } = await import('react-dom/client')

    const container = globalThis.document?.getElementById('root')
    if (!container) {
      throw new Error('OpenClaude web UI root element not found')
    }

    const globals = globalThis as BrowserGlobals

    const browserRoot =
      globals.__openclaudeWebUiRoot ?? createRoot(container)

    globals.__openclaudeWebUiRoot = browserRoot

    browserRoot.render(createLoadingScreen())

    const [
      { App },
      { REPL },
      { ChatWindow },
      { AppStateProvider },
      { startDeferredPrefetches },
    ] = await Promise.all([
      import('./components/App.js'),
      import('./screens/REPL.js'),
      import('./screens/ChatWindow.js'),
      import('./state/AppState.js'),
      import('./main.js'),
    ])

    const appElement = (
      <App {...appPropsForApp}>
        {/* <REPL {...replProps} /> */}
        <ChatWindow {...replProps} />
      </App>
    )

    browserRoot.render(
      <React.StrictMode>
        <AppStateProvider
          initialState={appProps.initialState}
          onChangeAppState={onChangeAppState}
        >
          {appElement}
        </AppStateProvider>
      </React.StrictMode>,
    )

    startDeferredPrefetches()

    return
  }

  const [{ App }, { REPL }] = await Promise.all([
    import('./components/App.js'),
    import('./screens/REPL.js'),
  ])

  const appElement = (
    <App {...appPropsForApp}>
      <REPL {...replProps} />
    </App>
  )

  await renderAndRun(terminalRoot, appElement)
}
