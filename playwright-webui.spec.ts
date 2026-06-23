import { expect, test } from 'playwright/test'

test('webui boots without browser errors', async ({ page }) => {
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

  await page.goto('http://127.0.0.1:3000/', {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(5000)

  expect.soft(pageErrors, pageErrors.join('\n')).toEqual([])
  expect.soft(consoleErrors, consoleErrors.join('\n')).toEqual([])
})
