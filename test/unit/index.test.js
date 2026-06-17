import deployPlugin from '../../index';

describe('index', function () {
    describe('main export', function () {
        it('registers a deploy task on the shipit instance', function () {
            const registered = [];
            const shipit = {
                config: {},
                task(name) {
                    registered.push(name);
                },
                on() {},
            };

            deployPlugin(shipit);

            expect(registered).toContain('deploy');
        });
    });

    describe('getServerList', function () {
        const originalUser = process.env.DEPLOY_USER;
        const originalServers = process.env.DEPLOY_SERVERS;

        afterEach(function () {
            restoreEnv('DEPLOY_USER', originalUser);
            restoreEnv('DEPLOY_SERVERS', originalServers);
        });

        it('maps a JSON array of servers to user@server entries', function () {
            process.env.DEPLOY_USER = 'deploy';
            process.env.DEPLOY_SERVERS = JSON.stringify(['host-a', 'host-b']);

            expect(deployPlugin.getServerList()).toEqual(['deploy@host-a', 'deploy@host-b']);
        });

        it('falls back to a single user@server string when the server list is not JSON', function () {
            process.env.DEPLOY_USER = 'deploy';
            process.env.DEPLOY_SERVERS = 'single-host';

            expect(deployPlugin.getServerList()).toBe('deploy@single-host');
        });
    });
});

function restoreEnv(key, value) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}
