var deploy = require('/app/index.js');

module.exports = function (shipit) {
    deploy(shipit);

    shipit.initConfig({
        default: {
            workspace: '/app/test/e2e/fixtures/test-project',
            deployTo: '/opt/deploy_to',
            ignores: ['.git', 'node_modules'],
            sharedLinks: [{
                name: 'node_modules',
                type: 'directory'
            }, {
                name: 'config.production.json',
                type: 'file'
            }]
        },
        production: {
            servers: deploy.getServerList()
        }
    });
};
