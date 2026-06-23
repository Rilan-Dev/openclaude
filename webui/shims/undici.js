export class Agent {
  constructor(options = {}) {
    this.options = options
  }
}

export class EnvHttpProxyAgent extends Agent {}
export class ProxyAgent extends Agent {}

let globalDispatcher = undefined

export function setGlobalDispatcher(dispatcher) {
  globalDispatcher = dispatcher
}

export function getGlobalDispatcher() {
  return globalDispatcher
}

export const fetch = (...args) => globalThis.fetch(...args)
export const Headers = globalThis.Headers
export const Request = globalThis.Request
export const Response = globalThis.Response
export const FormData = globalThis.FormData
export const File = globalThis.File
export const WebSocket = globalThis.WebSocket

export default {
  Agent,
  EnvHttpProxyAgent,
  File,
  FormData,
  Headers,
  ProxyAgent,
  Request,
  Response,
  WebSocket,
  fetch,
  getGlobalDispatcher,
  setGlobalDispatcher,
}
