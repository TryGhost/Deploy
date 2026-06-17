const { defineConfig } = require('vitest/config');

// The e2e suite drives a real deploy over SSH against the docker target in
// test/e2e/docker-compose.yml, so it runs separately from the unit suite,
// needs long timeouts, and collects no coverage.
module.exports = defineConfig({
    test: {
        globals: true,
        include: ['test/e2e/**/*.test.js'],
        testTimeout: 120000,
        hookTimeout: 120000,
    },
});
