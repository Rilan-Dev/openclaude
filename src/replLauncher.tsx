import React from 'react'
import type { StatsStore } from './context/stats.js'
import type { Root } from './ink.js'
import type { Props as REPLProps } from './screens/REPL.js'
import type { AppState } from './state/AppStateStore.js'
import type { FpsMetrics } from './utils/fpsTracker.js'

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
    const { AppStateProvider } = await import('./state/AppState.js')

    await renderAndRun(
      root,
      <AppStateProvider
        initialState={appProps.initialState}
        onChangeAppState={onChangeAppState}
      >
        {appElement}
      </AppStateProvider>,
    )

    return
  }

  await renderAndRun(root, appElement)
}