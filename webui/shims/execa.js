const result = {
  all: '',
  command: '',
  escapedCommand: '',
  exitCode: 1,
  failed: true,
  isCanceled: false,
  killed: false,
  signal: undefined,
  stderr: 'Subprocess execution is not available in the browser web UI',
  stdout: '',
  timedOut: false,
}

export async function execa() {
  return result
}

export function execaSync() {
  return result
}

export default execa
