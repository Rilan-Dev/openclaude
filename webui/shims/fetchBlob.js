const unavailable = name => {
  throw new Error(`${name} is not available in the browser web UI`)
}

export const Blob = globalThis.Blob
export const File = globalThis.File

export function blobFromSync() {
  unavailable('fetch-blob/from.js')
}

export async function blobFrom() {
  unavailable('fetch-blob/from.js')
}

export function fileFromSync() {
  unavailable('fetch-blob/from.js')
}

export async function fileFrom() {
  unavailable('fetch-blob/from.js')
}

export default blobFromSync
