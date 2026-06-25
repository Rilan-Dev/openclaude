import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const chromePath =
  'C:/Users/moham/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
const pageUrl = 'http://localhost:3000/'
const debugPort = 9336

async function waitForJsonList(port) {
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (res.ok) return await res.json()
    } catch {}
    await delay(200)
  }
  throw new Error('Timed out waiting for Chrome remote debugging port')
}

function logEvent(type, payload) {
  console.log(`[${type}] ${JSON.stringify(payload)}`)
}

const userDataDir = `C:/Users/moham/AppData/Local/Temp/openclaude-cdp-profile-${Date.now()}`
const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    pageUrl,
  ],
  { stdio: 'ignore', detached: true },
)

const targets = await waitForJsonList(debugPort)
const pageTarget = targets.find(t => t.type === 'page')
if (!pageTarget) {
  throw new Error(`No page target found: ${JSON.stringify(targets)}`)
}

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

let id = 0
const pending = new Map()
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logEvent('console', msg.params)
  } else if (msg.method === 'Runtime.exceptionThrown') {
    logEvent('exception', msg.params)
  } else if (msg.method === 'Log.entryAdded') {
    logEvent('log', msg.params)
  } else if (msg.method === 'Page.loadEventFired') {
    logEvent('load', msg.params)
  }
})

function send(method, params = {}) {
  const msgId = ++id
  ws.send(JSON.stringify({ id: msgId, method, params }))
  return new Promise((resolve, reject) =>
    pending.set(msgId, { resolve, reject }),
  )
}

await Promise.all([
  send('Runtime.enable'),
  send('Page.enable'),
  send('Log.enable'),
  send('Console.enable'),
])

await send('Page.navigate', { url: pageUrl })
await delay(8000)

await send('Runtime.evaluate', {
  expression: `(() => {
    window.__probeErrors = [];
    window.addEventListener('error', event => {
      window.__probeErrors.push({
        kind: 'error',
        message: event.message,
        stack: event.error?.stack ?? null,
      });
    });
    window.addEventListener('unhandledrejection', event => {
      const reason = event.reason;
      window.__probeErrors.push({
        kind: 'unhandledrejection',
        message: typeof reason === 'string' ? reason : reason?.message ?? String(reason),
        stack: reason?.stack ?? null,
      });
    });
    return true;
  })()`,
  returnByValue: true,
})

const evalResult = await send('Runtime.evaluate', {
  expression: `({
    href: location.href,
    readyState: document.readyState,
    rootExists: !!document.querySelector('#root'),
    rootChildCount: document.querySelector('#root')?.childNodes.length ?? -1,
    bodyText: document.body.textContent?.slice(0, 200) ?? '',
})`,
  returnByValue: true,
})
console.log(`[page] ${JSON.stringify(evalResult)}`)

const probePrompt = process.env.WEBUI_PROBE_PROMPT
if (probePrompt) {
  const setInputResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const textarea = document.querySelector('textarea')
      if (!textarea) return { ok: false, reason: 'missing-textarea' }
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set
      valueSetter?.call(textarea, ${JSON.stringify(probePrompt)})
      textarea.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          composed: true,
          inputType: 'insertText',
          data: ${JSON.stringify(probePrompt)},
        }),
      )
      return { ok: textarea.value === ${JSON.stringify(probePrompt)}, value: textarea.value }
    })()`,
    returnByValue: true,
  })
  console.log(`[input] ${JSON.stringify(setInputResult)}`)

  const submitResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const form = document.querySelector('form')
      if (!form) return { ok: false, reason: 'missing-form' }
      form.requestSubmit()
      return { ok: true }
    })()`,
    returnByValue: true,
  })
  console.log(`[submit] ${JSON.stringify(submitResult)}`)

  await delay(6000)

  const postSubmitState = await send('Runtime.evaluate', {
    expression: `({
      bodyText: document.body.textContent?.slice(0, 500) ?? '',
      textareaValue: document.querySelector('textarea')?.value ?? null,
      messageCount: document.querySelectorAll('article').length,
      probeErrors: window.__probeErrors ?? [],
    })`,
    returnByValue: true,
  })
  console.log(`[post-submit] ${JSON.stringify(postSubmitState)}`)
}

const fiberResult = await send('Runtime.evaluate', {
  expression: `(() => {
    const root = document.querySelector('#root')
    if (!root) return null
    const fiberKey = Object.keys(root).find(key => key.startsWith('__reactContainer$') || key.startsWith('__reactFiber$'))
    if (!fiberKey) return { fiberKey: null }
    const fiber = root[fiberKey]
    const seen = new Set()
    const describe = node => {
      if (!node) return null
      const type = node.type || node.elementType || node.elementType?.type || node.tag
      const name =
        typeof type === 'string'
          ? type
          : type?.displayName || type?.name || type?.render?.name || type?.$$typeof?.toString?.() || null
      return {
        tag: node.tag,
        key: node.key ?? null,
        name,
        child: describe(node.child),
        sibling: describe(node.sibling),
      }
    }
    return { fiberKey, tree: describe(fiber) }
  })()`,
  returnByValue: true,
})
console.log(`[fiber] ${JSON.stringify(fiberResult)}`)

ws.close()
chrome.kill()
console.log('probe-complete')
