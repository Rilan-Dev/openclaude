import * as ReactDOMClient from '../node_modules/react-dom/client.js'

const client = ReactDOMClient as Record<string, any>

export const createRoot = client.createRoot
export const hydrateRoot = client.hydrateRoot
export const version = client.version
export default client
