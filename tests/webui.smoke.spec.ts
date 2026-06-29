import { expect, test } from 'playwright/test'

test('webui startup state', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText ?? 'request failed'
    const url = request.url()
    if (!url.includes('favicon.ico')) {
      consoleErrors.push(`${url} :: ${failure}`)
    }
  })

  const url = process.env.PLAYWRIGHT_WEBUI_URL ?? 'http://127.0.0.1:5177/'
  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  })
  await page.waitForTimeout(3000)

  const bodyText = await page.locator('body').innerText().catch(() => '')
  const bodyHtml = await page.locator('body').innerHTML().catch(() => '')

  console.log('PAGE_URL:', url)
  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors, null, 2))
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors, null, 2))
  console.log('BODY_TEXT:', bodyText)
  console.log('BODY_HTML:', bodyHtml.slice(0, 4000))

  expect.soft(pageErrors, pageErrors.join('\n')).toEqual([])
  expect.soft(consoleErrors, consoleErrors.join('\n')).toEqual([])
  expect(bodyHtml.length).toBeGreaterThan(0)
})
