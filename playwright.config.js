const { defineConfig } = require('@playwright/test');

const deployedURL = process.env.KIOSK_TEST_URL;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  use: {
    baseURL: deployedURL || 'http://127.0.0.1:8774',
    hasTouch: true,
    viewport: { width: 1920, height: 1080 },
    reducedMotion: 'reduce',
    actionTimeout: 6000,
  },
  webServer: deployedURL ? undefined : {
    command: 'npm run build && http-server dist -a 127.0.0.1 -p 8774 -c-1',
    url: 'http://127.0.0.1:8774',
    stderr: 'ignore',
  },
});
