import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

function run(
  command: string,
  args: string[],
  options: {
    cwd?: string
    env?: NodeJS.ProcessEnv
  } = {},
): Promise<number> {
  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: 'inherit',
    })

    child.on('close', code => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

function readRenderModeFromDotEnv(): string | undefined {
  for (const filePath of ['.env', 'webui/.env']) {
    try {
      const raw = readFileSync(filePath, 'utf8')
      const match = raw.match(/^\s*OPENCLAUDE_RENDER_MODE\s*=\s*(.+)\s*$/m)
      if (!match?.[1]) continue
      return match[1].trim().replace(/^['"]|['"]$/g, '')
    } catch {
      // Try the next file.
    }
  }

  return undefined
}

async function main(): Promise<void> {
  const renderMode =
    process.env.OPENCLAUDE_RENDER_MODE?.trim().toLowerCase() ??
    readRenderModeFromDotEnv()?.trim().toLowerCase()

  if (renderMode === 'web') {
    process.exitCode = await run(process.execPath, [
      'run',
      '--cwd',
      'webui',
      'dev',
    ])
    return
  }

  const buildCode = await run(process.execPath, ['run', 'build'])
  if (buildCode !== 0) {
    process.exitCode = buildCode
    return
  }

  process.exitCode = await run('node', ['bin/openclaude'])
}

void main()
