import * as ReactModule from '../node_modules/react/index.js'

type ReactModuleType = typeof import('../node_modules/react/index.js')

const React = ((ReactModule as { default?: ReactModuleType } & ReactModuleType).default ?? ReactModule) as ReactModuleType

export const {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  use,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useInsertionEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} = React as ReactModuleType

export type {
  ComponentType,
  CSSProperties,
  Dispatch,
  MutableRefObject,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  Ref,
  SetStateAction,
} from '../node_modules/react/index.js'

export * from '../node_modules/react/index.js'

export default React
