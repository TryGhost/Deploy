const Shipit = require('shipit-cli');
const { execSync } = require('child_process');

const DEPLOY_TO = '/opt/deploy_to';

function remote(cmd) {
    return execSync('ssh deploy@target "' + cmd + '"', { encoding: 'utf8' }).trim();
}

function runDeploy(configOverrides) {
    return new Promise(function (resolve, reject) {
        const shipit = new Shipit({ environment: 'production' });
        require('./fixtures/shipitfile')(shipit, configOverrides);
        shipit.initialize();
        shipit.start('deploy', function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

describe('Deploy', function () {
    beforeAll(async function () {
        // Create shared directory and config file on target
        remote(
            'mkdir -p ' +
                DEPLOY_TO +
                '/shared && touch ' +
                DEPLOY_TO +
                '/shared/config.production.json',
        );

        // Run the deploy
        process.env.NO_RESTART = 'false';
        await runDeploy();
    });

    describe('Release structure', function () {
        it('creates a releases directory', function () {
            remote('test -d ' + DEPLOY_TO + '/releases');
        });

        it('creates exactly one release', function () {
            const count = remote('ls ' + DEPLOY_TO + '/releases | wc -l');
            expect(count).toBe('1');
        });
    });

    describe('Current symlink', function () {
        it('creates a current symlink', function () {
            remote('test -L ' + DEPLOY_TO + '/current');
        });

        it('points into the releases directory', function () {
            const target = remote('readlink ' + DEPLOY_TO + '/current');
            expect(target).toContain(DEPLOY_TO + '/releases/');
        });
    });

    describe('Shared links', function () {
        it('creates the shared node_modules directory', function () {
            remote('test -d ' + DEPLOY_TO + '/shared/node_modules');
        });

        it('symlinks node_modules into current', function () {
            remote('test -L ' + DEPLOY_TO + '/current/node_modules');
        });

        it('symlinks config.production.json into current', function () {
            remote('test -L ' + DEPLOY_TO + '/current/config.production.json');
        });
    });

    describe('Deployed files', function () {
        it('includes package.json', function () {
            remote('test -f ' + DEPLOY_TO + '/current/package.json');
        });

        it('includes index.js', function () {
            remote('test -f ' + DEPLOY_TO + '/current/index.js');
        });

        it('has the correct package.json content', function () {
            const content = remote('cat ' + DEPLOY_TO + '/current/package.json');
            expect(content).toContain('test-deploy-target');
        });
    });

    describe('Dependency installation', function () {
        it('installs lodash via yarn', function () {
            remote('test -d ' + DEPLOY_TO + '/shared/node_modules/lodash');
        });
    });

    describe('Post-deploy directories', function () {
        it('creates the tmp directory', function () {
            remote('test -d ' + DEPLOY_TO + '/current/tmp');
        });

        it('creates the public directory', function () {
            remote('test -d ' + DEPLOY_TO + '/current/public');
        });
    });

    describe('Restart behavior', function () {
        it('creates restart.txt when NO_RESTART=false', function () {
            remote('test -f ' + DEPLOY_TO + '/current/tmp/restart.txt');
        });
    });

    describe('Release clean-up', function () {
        beforeAll(async function () {
            // Create 12 fake old releases (prefixed with 0 so they sort before real ones)
            // After deploying: 12 fake + 1 existing + 1 new = 14 total
            // Clean-up removes the 4 oldest, leaving 10
            for (let i = 0; i < 12; i++) {
                remote(
                    'mkdir -p ' +
                        DEPLOY_TO +
                        '/releases/0000-fake-release-' +
                        String(i).padStart(2, '0'),
                );
            }

            // Deploy again
            await runDeploy();
        });

        it('keeps no more than 10 releases', function () {
            const count = remote('ls ' + DEPLOY_TO + '/releases | wc -l');
            expect(count).toBe('10');
        });

        it('removes the oldest releases first', function () {
            const releases = remote('ls ' + DEPLOY_TO + '/releases');
            // The 4 oldest fakes (00-03) should be gone
            expect(releases).not.toContain('0000-fake-release-00');
            expect(releases).not.toContain('0000-fake-release-03');
            // The 8 newest fakes (04-11) should still be present
            expect(releases).toContain('0000-fake-release-04');
            expect(releases).toContain('0000-fake-release-11');
        });

        it('keeps the current symlink valid', function () {
            remote('test -d ' + DEPLOY_TO + '/current');
        });
    });
});

// The deploy runtime picks the package manager from shipit.config.npm:
// `npm install` when true, `yarn install` (the default) otherwise — see
// lib/deploy.ts. The suite above exercises the default yarn branch end to
// end; this one proves the npm branch actually installs on a real target,
// so a dependency bump or runtime change that breaks it fails CI instead of
// being silently auto-merged.
describe('Deploy with npm (shipit.config.npm = true)', function () {
    // Under the deploy user's own home so it can be created without the extra
    // /opt provisioning the default-path deployTo gets in the target image.
    const NPM_DEPLOY_TO = '/home/deploy/deploy_to_npm';

    beforeAll(async function () {
        // Isolated deployTo so this does not disturb the default-path deploy.
        remote(
            'mkdir -p ' +
                NPM_DEPLOY_TO +
                '/shared && touch ' +
                NPM_DEPLOY_TO +
                '/shared/config.production.json',
        );

        process.env.NO_RESTART = 'false';
        await runDeploy({ npm: true, deployTo: NPM_DEPLOY_TO });
    });

    it('installs lodash so the deployed app can resolve it', function () {
        // Asserted via current/ rather than shared/: npm (unlike yarn) replaces
        // the symlinked node_modules with a real directory in the release, so
        // the shared-dir optimisation does not apply to the npm path. What
        // matters is that the dependency is resolvable from the deployed app.
        remote('test -d ' + NPM_DEPLOY_TO + '/current/node_modules/lodash');
    });

    it('runs npm rather than yarn (writes package-lock.json, no yarn.lock)', function () {
        remote('test -f ' + NPM_DEPLOY_TO + '/current/package-lock.json');
        remote('test ! -f ' + NPM_DEPLOY_TO + '/current/yarn.lock');
    });
});

// The pnpm branch of the same package-manager selector. pnpm is the runtime
// option consumers migrating to pnpm need (GVA-795); unlike npm and yarn it is
// not bundled with Node, so the target image provisions it (see target image).
describe('Deploy with pnpm (shipit.config.packageManager = "pnpm")', function () {
    const PNPM_DEPLOY_TO = '/home/deploy/deploy_to_pnpm';

    beforeAll(async function () {
        remote(
            'mkdir -p ' +
                PNPM_DEPLOY_TO +
                '/shared && touch ' +
                PNPM_DEPLOY_TO +
                '/shared/config.production.json',
        );

        process.env.NO_RESTART = 'false';
        await runDeploy({
            packageManager: 'pnpm',
            deployTo: PNPM_DEPLOY_TO,
            // pnpm cannot install into a symlinked node_modules — it runs
            // `mkdir node_modules` and fails with ENOTDIR — and its global
            // store already hardlink-dedupes packages across releases, so the
            // shared-node_modules optimisation is both unusable and redundant
            // for pnpm. pnpm consumers therefore omit node_modules from
            // sharedLinks (documented in the README).
            sharedLinks: [{ name: 'config.production.json', type: 'file' }],
        });
    });

    it('installs lodash so the deployed app can resolve it', function () {
        remote('test -d ' + PNPM_DEPLOY_TO + '/current/node_modules/lodash');
    });

    it('runs pnpm (writes pnpm-lock.yaml, no package-lock.json or yarn.lock)', function () {
        remote('test -f ' + PNPM_DEPLOY_TO + '/current/pnpm-lock.yaml');
        remote('test ! -f ' + PNPM_DEPLOY_TO + '/current/package-lock.json');
        remote('test ! -f ' + PNPM_DEPLOY_TO + '/current/yarn.lock');
    });
});
