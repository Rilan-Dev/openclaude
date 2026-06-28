import * as ReactJsxDevRuntime from '../node_modules/react/jsx-dev-runtime.js'

const runtime = ReactJsxDevRuntime as typeof import('../node_modules/react/jsx-dev-runtime.js')

export const Fragment = runtime.Fragment
export const jsxDEV = runtime.jsxDEV
export default runtime
export * from '../node_modules/react/jsx-dev-runtime.js'
