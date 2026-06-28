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

export async function launchRepl(
  root: Root,
  appProps: AppWrapperProps,
  replProps: REPLProps,
  renderAndRun: (
    root: Root,
    element: React.ReactNode,
  ) => Promise<void>,
): Promise<void> {
  const { App } = await import('./components/App.js')
  const { REPL } = await import('./screens/REPL.js')

  const { onChangeAppState, ...appPropsForApp } = appProps

  const appElement = (
    <App {...appPropsForApp}>
      <REPL {...replProps} />
    </App>
  )

  if (appProps.renderMode === 'web') {
    const [
      { createRoot },
      { AppStateProvider },
      { startDeferredPrefetches },
    ] = await Promise.all([
      import('react-dom/client'),
      import('./state/AppState.js'),
      import('./main.js'),
    ])

    const container = globalThis.document?.getElementById('root')
    if (!container) {
      throw new Error('OpenClaude web UI root element not found')
    }

    const globals = globalThis as BrowserGlobals
    const browserRoot = globals.__openclaudeWebUiRoot ?? createRoot(container)
    globals.__openclaudeWebUiRoot = browserRoot

    browserRoot.render(
      <AppStateProvider
        initialState={appProps.initialState}
        onChangeAppState={onChangeAppState}
      >
        {appElement}
      </AppStateProvider>,
    )

    startDeferredPrefetches()

    return
  }

  await renderAndRun(root, appElement)
}
