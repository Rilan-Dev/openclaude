import React, { type ComponentType, type ReactNode } from 'react';
import type { StatsStore } from '../context/stats.js';
import type { AppState } from '../state/AppStateStore.js';
import type { FpsMetrics } from '../utils/fpsTracker.js';
type Props = {
  getFpsMetrics: () => FpsMetrics | undefined;
  stats?: StatsStore;
  initialState?: AppState;
  children?: ReactNode;
  renderMode?: 'terminal' | 'web';
};

type RuntimeComponent<P> = ComponentType<P & { children?: ReactNode }>;
type TerminalProviders = {
  FpsMetricsProvider: RuntimeComponent<{
    getFpsMetrics: () => FpsMetrics | undefined;
  }>;
  StatsProvider: RuntimeComponent<{
    store?: StatsStore;
  }>;
  AppStateProvider: RuntimeComponent<{
    initialState?: AppState;
    onChangeAppState: (args: {
      newState: AppState;
      oldState: AppState;
    }) => void;
  }>;
  onChangeAppState: (args: {
    newState: AppState;
    oldState: AppState;
  }) => void;
};

let terminalProviders: TerminalProviders | undefined;

function getTerminalProviders(): TerminalProviders {
  if (!terminalProviders) {
    const runtimeRequire = (0, eval)('require') as (id: string) => unknown;
    const fpsMetrics = runtimeRequire('../context/fpsMetrics.js') as Pick<TerminalProviders, 'FpsMetricsProvider'>;
    const stats = runtimeRequire('../context/stats.js') as Pick<TerminalProviders, 'StatsProvider'>;
    const appState = runtimeRequire('../state/AppState.js') as Pick<TerminalProviders, 'AppStateProvider'>;
    const appStateChange = runtimeRequire('../state/onChangeAppState.js') as Pick<TerminalProviders, 'onChangeAppState'>;
    terminalProviders = {
      FpsMetricsProvider: fpsMetrics.FpsMetricsProvider,
      StatsProvider: stats.StatsProvider,
      AppStateProvider: appState.AppStateProvider,
      onChangeAppState: appStateChange.onChangeAppState
    };
  }
  return terminalProviders;
}

/**
 * Top-level wrapper for interactive sessions.
 * Provides FPS metrics, stats context, and app state to the component tree.
 */
export function App(t0: Props) {
  const {
    getFpsMetrics,
    stats,
    initialState,
    children,
    renderMode = 'terminal'
  } = t0;
  if (renderMode === 'web') {
    return React.createElement('div', {
      style: {
        minHeight: '100vh',
        background: 'radial-gradient(circle at top left, rgba(65, 89, 141, 0.22), transparent 34rem), linear-gradient(135deg, #0b1117 0%, #11181f 44%, #16110d 100%)',
        color: '#f3eadc',
        fontFamily: '"IBM Plex Sans", "Aptos", "Segoe UI", sans-serif'
      }
    }, children);
  }
  const {
    FpsMetricsProvider,
    StatsProvider,
    AppStateProvider,
    onChangeAppState
  } = getTerminalProviders();
  return React.createElement(FpsMetricsProvider, {
    getFpsMetrics
  }, React.createElement(StatsProvider, {
    store: stats
  }, React.createElement(AppStateProvider, {
    initialState,
    onChangeAppState
  }, children)));
}
