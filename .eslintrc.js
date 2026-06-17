module.exports = {
    plugins: ['ghost'],
    extends: [
        'plugin:ghost/node',
    ],
    overrides: [
        {
            // Vitest exposes its API as globals (test.globals: true) for both the
            // unit suite and the docker-based e2e suite.
            files: ['test/**/*.js'],
            globals: {
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterEach: 'readonly',
                vi: 'readonly'
            }
        }
    ]
};
