// Require the built output, exactly as a consumer of the published package
// would — the e2e exercises dist/, not the TypeScript source.
const deploy = require('/app/dist/index.js');

module.exports = function (shipit, configOverrides = {}) {
    deploy(shipit);

    shipit.initConfig({
        default: Object.assign(
            {
                workspace: '/app/test/e2e/fixtures/test-project',
                deployTo: '/opt/deploy_to',
                ignores: ['.git', 'node_modules'],
                sharedLinks: [
                    {
                        name: 'node_modules',
                        type: 'directory',
                    },
                    {
                        name: 'config.production.json',
                        type: 'file',
                    },
                ],
            },
            configOverrides,
        ),
        production: {
            servers: deploy.getServerList(),
        },
    });
};
