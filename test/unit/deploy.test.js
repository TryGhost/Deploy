const deploy = require('../../lib/deploy');

function createShipit(config) {
    const calls = { remote: [], remoteCopy: [], log: [], emit: [] };
    const tasks = {};

    const shipit = {
        config,
        task(name, fn) {
            tasks[name] = fn;
        },
        async remote(cmd) {
            calls.remote.push(cmd);
        },
        async remoteCopy(from, to, options) {
            calls.remoteCopy.push({ from, to, options });
        },
        log(message) {
            calls.log.push(message);
        },
        emit(event) {
            calls.emit.push(event);
        },
    };

    return { shipit, calls, tasks };
}

function baseConfig(overrides) {
    return Object.assign(
        {
            deployTo: '/opt/deploy_to',
            workspace: '/work',
            sharedLinks: [],
        },
        overrides,
    );
}

describe('lib/deploy', function () {
    const originalNoRestart = process.env.NO_RESTART;

    afterEach(function () {
        if (originalNoRestart === undefined) {
            delete process.env.NO_RESTART;
        } else {
            process.env.NO_RESTART = originalNoRestart;
        }
    });

    it('registers both deploy and default tasks', function () {
        const { shipit, tasks } = createShipit(baseConfig());
        deploy(shipit);

        expect(typeof tasks.deploy).toBe('function');
        expect(tasks.default).toEqual(['deploy']);
    });

    it('builds the release structure and installs production deps with yarn by default', async function () {
        process.env.NO_RESTART = 'true';
        const { shipit, calls, tasks } = createShipit(baseConfig());
        deploy(shipit);

        await tasks.deploy();

        const remote = calls.remote.join('\n');
        expect(remote).toContain('mkdir -p /opt/deploy_to/releases');
        expect(remote).toContain('ln -nfs');
        expect(remote).toContain('yarn install --production');
        expect(calls.remoteCopy).toHaveLength(1);
        expect(calls.remoteCopy[0].options).toEqual({ rsync: '--del' });
        expect(calls.remoteCopy[0].from.startsWith('/work')).toBe(true);
        expect(calls.emit).toContain('deployed');
        expect(remote).not.toContain('restart.txt');
    });

    it('honours rsyncFrom, dirToCopy and custom remoteCopy options', async function () {
        process.env.NO_RESTART = 'true';
        const config = baseConfig({
            rsyncFrom: '/custom-src',
            dirToCopy: 'dist',
            deploy: { remoteCopy: { rsync: '--archive' } },
        });
        const { shipit, calls, tasks } = createShipit(config);
        deploy(shipit);

        await tasks.deploy();

        expect(calls.remoteCopy[0].from).toContain('/custom-src/dist');
        expect(calls.remoteCopy[0].options).toEqual({ rsync: '--archive' });
    });

    it('installs all deps with npm and writes restart.txt when configured', async function () {
        process.env.NO_RESTART = 'false';
        const config = baseConfig({ npm: true, allDeps: true });
        const { shipit, calls, tasks } = createShipit(config);
        deploy(shipit);

        await tasks.deploy();

        const remote = calls.remote.join('\n');
        expect(/npm install(?! --production)/.test(remote)).toBe(true);
        expect(remote).toContain('restart.txt');
    });

    it('installs production deps with pnpm when packageManager is "pnpm"', async function () {
        process.env.NO_RESTART = 'true';
        const { shipit, calls, tasks } = createShipit(baseConfig({ packageManager: 'pnpm' }));
        deploy(shipit);

        await tasks.deploy();

        const remote = calls.remote.join('\n');
        // pnpm's production flag is --prod, not the --production npm/yarn use.
        expect(remote).toContain('pnpm install --prod');
        expect(remote).not.toContain('--production');
    });

    it('installs all deps with pnpm when packageManager is "pnpm" and allDeps is set', async function () {
        process.env.NO_RESTART = 'true';
        const { shipit, calls, tasks } = createShipit(
            baseConfig({ packageManager: 'pnpm', allDeps: true }),
        );
        deploy(shipit);

        await tasks.deploy();

        const remote = calls.remote.join('\n');
        expect(/pnpm install(?! --prod)/.test(remote)).toBe(true);
    });

    it('lets an explicit packageManager take precedence over the legacy npm flag', async function () {
        process.env.NO_RESTART = 'true';
        const { shipit, calls, tasks } = createShipit(
            baseConfig({ packageManager: 'yarn', npm: true }),
        );
        deploy(shipit);

        await tasks.deploy();

        const remote = calls.remote.join('\n');
        expect(remote).toContain('yarn install --production');
        expect(remote).not.toContain('npm install');
    });

    it('fails the deploy up front for an unknown packageManager', async function () {
        process.env.NO_RESTART = 'true';
        const { shipit, calls, tasks } = createShipit(baseConfig({ packageManager: 'bun' }));
        deploy(shipit);

        await expect(tasks.deploy()).rejects.toThrow(/Unknown packageManager "bun"/);
        // Resolved before any remote work, so nothing was copied to the server.
        expect(calls.remoteCopy).toHaveLength(0);
        expect(calls.remote).toHaveLength(0);
    });

    it('treats an explicitly empty packageManager as invalid rather than falling back', async function () {
        process.env.NO_RESTART = 'true';
        const { shipit, tasks } = createShipit(baseConfig({ packageManager: '' }));
        deploy(shipit);

        await expect(tasks.deploy()).rejects.toThrow(/Unknown packageManager/);
    });

    it('creates shared directories only for directory links and honours custom link targets', async function () {
        process.env.NO_RESTART = 'true';
        const config = baseConfig({
            sharedLinks: [
                { name: 'node_modules', type: 'directory' },
                { name: 'config.production.json', type: 'file' },
                { name: 'logs', target: 'var/logs', type: 'directory' },
            ],
        });
        const { shipit, calls, tasks } = createShipit(config);
        deploy(shipit);

        await tasks.deploy();

        const remote = calls.remote.join('\n');
        expect(remote).toContain('mkdir -p /opt/deploy_to/shared/node_modules');
        expect(remote).not.toContain('mkdir -p /opt/deploy_to/shared/config.production.json');
        expect(remote).toContain('/opt/deploy_to/current/var/logs');
    });
});
