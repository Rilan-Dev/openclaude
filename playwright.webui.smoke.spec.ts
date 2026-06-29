import { expect, test } from '@playwright/test'

test('captures web ui startup state', async ({ page }) => {
  const consoleMessages: string[] = []
  const pageErrors: string[] = []

  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', error => {
    pageErrors.push(String(error))
  })

  await page.goto('http://127.0.0.1:5177/', {
    waitUntil: 'networkidle',
    timeout: 120_000,
  })

  await page.waitForTimeout(2000)

  const bodyText = await page.locator('body').innerText().catch(() => '')
  const bodyHtml = await page.locator('body').innerHTML().catch(() => '')

  // Emit the observed state to the test output so we can inspect it
  // from the shell without opening the browser manually.
  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors, null, 2))
  console.log('CONSOLE_MESSAGES:', JSON.stringify(consoleMessages, null, 2))
  console.log('BODY_TEXT:', bodyText)
  console.log('BODY_HTML:', bodyHtml.slice(0, 4000))

  expect(bodyHtml.length).toBeGreaterThan(0)
})
