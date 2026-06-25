class FetchError extends Error {
  constructor(message, type = 'system', systemError) {
    super(message)
    this.name = 'FetchError'
    this.type = type
    this.code = systemError?.code
    this.errno = systemError?.errno
    this.cause = systemError
  }
}

class AbortError extends Error {
  constructor(message = 'The operation was aborted') {
    super(message)
    this.name = 'AbortError'
  }
}

const browserFetch = (...args) => globalThis.fetch(...args)

export const Headers = globalThis.Headers
export const Request = globalThis.Request
export const Response = globalThis.Response
export const FormData = globalThis.FormData
export const File = globalThis.File
export const Blob = globalThis.Blob
export { AbortError, FetchError }

export default browserFetch
