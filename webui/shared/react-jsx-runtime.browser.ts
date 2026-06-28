import * as ReactJsxRuntime from '../node_modules/react/jsx-runtime.js'

const runtime = ReactJsxRuntime as typeof import('../node_modules/react/jsx-runtime.js')

export const Fragment = runtime.Fragment
export const jsx = runtime.jsx
export const jsxs = runtime.jsxs
export default runtime
export * from '../node_modules/react/jsx-runtime.js'
