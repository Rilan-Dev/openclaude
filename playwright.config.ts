export default {
  testDir: '.',
  testMatch: ['**/*.spec.ts'],
  use: {
    browserName: 'chromium',
    headless: true,
  },
}
