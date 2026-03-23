module.exports = {
    plugins: ['ghost'],
    extends: [
        'plugin:ghost/node',
    ],
    overrides: [
        {
            files: ['test/**/*.js'],
            env: {
                mocha: true
            }
        }
    ]
};
