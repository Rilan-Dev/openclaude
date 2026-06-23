function unavailable() {
  throw new Error('Image processing with sharp is not available in the browser web UI')
}

export default function sharp() {
  unavailable()
}

export { sharp }
