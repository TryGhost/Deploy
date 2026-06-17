const deploy = require('/app/index.js');

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
