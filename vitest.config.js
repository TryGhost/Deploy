const {defineConfig} = require('vitest/config');

module.exports = defineConfig({
    test: {
        globals: true,
        include: ['test/unit/**/*.test.js'],
        coverage: {
            provider: 'v8',
            include: ['index.js', 'lib/**/*.js'],
            reporter: ['text', 'text-summary'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80
            }
        }
    }
});
