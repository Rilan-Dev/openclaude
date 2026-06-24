import { runtimeRequire } from '../imports.js'

export type ComputerUseDisplayGeometry = {
  id?: number
  width: number
  height: number
  scaleFactor: number
}

export type ComputerUseAPI = {
  apps: {
    prepareDisplay: (
      allowlistBundleIds: string[],
      hostBundleId: string,
      displayId?: number,
    ) => Promise<{
      hidden: string[]
      activated?: string | null
    }>

    previewHideSet: (
      allowlistBundleIds: string[],
      displayId?: number,
    ) => Promise<Array<{ bundleId: string; displayName: string }>>

    findWindowDisplays: (
      bundleIds: string[],
    ) => Promise<Array<{ bundleId: string; displayIds: number[] }>>

    appUnderPoint: (
      x: number,
      y: number,
    ) => Promise<{ bundleId: string; displayName: string } | null>

    listInstalled: () => Promise<
      Array<{
        bundleId: string
        displayName: string
        path: string
      }>
    >

    iconDataUrl: (path: string) => string | undefined

    listRunning: () => Promise<
      Array<{
        bundleId: string
        displayName: string
      }>
    >

    open: (bundleId: string) => Promise<void>
    unhide: (bundleIds: string[]) => Promise<void>
  }

  display: {
    getSize: (displayId?: number) => ComputerUseDisplayGeometry
    listAll: () => Promise<ComputerUseDisplayGeometry[]>
  }

  screenshot: {
    captureExcluding: (
      allowedBundleIds: string[],
      quality: number,
      targetWidth: number,
      targetHeight: number,
      displayId?: number,
    ) => Promise<{
      base64: string
      width: number
      height: number
    }>

    captureRegion: (
      allowedBundleIds: string[],
      x: number,
      y: number,
      width: number,
      height: number,
      targetWidth: number,
      targetHeight: number,
      quality: number,
      displayId?: number,
    ) => Promise<{
      base64: string
      width: number
      height: number
    }>
  }

  resolvePrepareCapture: (
    allowedBundleIds: string[],
    hostBundleId: string,
    quality: number,
    targetWidth: number,
    targetHeight: number,
    preferredDisplayId: number | undefined,
    autoResolve: boolean,
    doHide?: boolean,
  ) => Promise<unknown>
}


const COMPUTER_USE_SWIFT_PACKAGE = ['@ant', 'computer-use-swift'].join('/')

let cached: ComputerUseAPI | undefined


/**
 * Package's js/index.js reads COMPUTER_USE_SWIFT_NODE_PATH (baked by
 * build-with-plugins.ts on darwin targets, unset otherwise — falls through to
 * the node_modules prebuilds/ path). We cache the loaded native module.
 *
 * The four @MainActor methods (captureExcluding, captureRegion,
 * apps.listInstalled, resolvePrepareCapture) dispatch to DispatchQueue.main
 * and will hang under libuv unless CFRunLoop is pumped — call sites wrap
 * these in drainRunLoop().
 */
export function requireComputerUseSwift(): ComputerUseAPI {
  if (process.platform !== 'darwin') {
    throw new Error('@ant/computer-use-swift is macOS-only')
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (cached ??= runtimeRequire<ComputerUseAPI>(
    COMPUTER_USE_SWIFT_PACKAGE,
  ))
}