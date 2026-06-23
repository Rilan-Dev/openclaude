import { runtimeRequire } from './imports.js'

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

type ExecFileOptions = {
  cwd?: string
  timeout?: number
}

type ExecFileResult = {
  stdout: string
}

function execFileAsync(
  command: string,
  args: string[],
  options?: ExecFileOptions,
): Promise<ExecFileResult> {
  if (isBrowserRuntime()) {
    return Promise.resolve({ stdout: '' })
  }

  const { execFile } = runtimeRequire<typeof import('child_process')>(
    'child_process',
  )

  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }

      resolve({
        stdout: typeof stdout === 'string' ? stdout : String(stdout ?? ''),
      })
    })
  })
}

/**
 * Portable worktree detection using only child_process — no analytics,
 * no bootstrap deps, no execa. Used by listSessionsImpl.ts (SDK) and
 * anywhere that needs worktree paths without pulling in the CLI
 * dependency chain (execa → cross-spawn → which).
 */
export async function getWorktreePathsPortable(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['worktree', 'list', '--porcelain'],
      { cwd, timeout: 5000 },
    )
    if (!stdout) return []
    return stdout
      .split('\n')
      .filter(line => line.startsWith('worktree '))
      .map(line => line.slice('worktree '.length).normalize('NFC'))
  } catch {
    return []
  }
}
