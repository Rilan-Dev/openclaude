import * as ReactDOMClient from '../node_modules/react-dom/cjs/react-dom-client.development.js'

const client = (ReactDOMClient as Record<string, any>).default ??
  (ReactDOMClient as Record<string, any>)

export const createRoot = client.createRoot as typeof import('react-dom/client').createRoot
export const hydrateRoot = client.hydrateRoot as typeof import('react-dom/client').hydrateRoot
export const version = client.version as typeof import('react-dom/client').version
