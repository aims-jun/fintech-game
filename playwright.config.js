const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  use: {
    baseURL: 'http://127.0.0.1:8774',
    hasTouch: true,
    viewport: { width: 1920, height: 1080 },
    reducedMotion: 'reduce',
    actionTimeout: 6000,
  },
  webServer: {
    command: 'npm run build && http-server dist -a 127.0.0.1 -p 8774 -c-1',
    url: 'http://127.0.0.1:8774',
    stderr: 'ignore',
  },
});
