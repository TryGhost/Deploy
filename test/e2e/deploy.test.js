const Shipit = require('shipit-cli');
const {execSync} = require('child_process');
const assert = require('assert');

const DEPLOY_TO = '/opt/deploy_to';

function remote(cmd) {
    return execSync('ssh deploy@target "' + cmd + '"', {encoding: 'utf8'}).trim();
}

describe('Deploy', function () {
    this.timeout(120000);

    before(function (done) {
        // Create shared directory and config file on target
        remote('mkdir -p ' + DEPLOY_TO + '/shared && touch ' + DEPLOY_TO + '/shared/config.production.json');

        // Run the deploy
        process.env.NO_RESTART = 'false';
        const shipit = new Shipit({environment: 'production'});
        require('./fixtures/shipitfile')(shipit);
        shipit.initialize();
        shipit.start('deploy', done);
    });

    describe('Release structure', function () {
        it('creates a releases directory', function () {
            remote('test -d ' + DEPLOY_TO + '/releases');
        });

        it('creates exactly one release', function () {
            const count = remote('ls ' + DEPLOY_TO + '/releases | wc -l');
            assert.equal(count, '1');
        });
    });

    describe('Current symlink', function () {
        it('creates a current symlink', function () {
            remote('test -L ' + DEPLOY_TO + '/current');
        });

        it('points into the releases directory', function () {
            const target = remote('readlink ' + DEPLOY_TO + '/current');
            assert.ok(target.includes(DEPLOY_TO + '/releases/'), 'Expected symlink to point into releases, got: ' + target);
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
            assert.ok(content.includes('test-deploy-target'), 'Expected package.json to contain "test-deploy-target"');
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
        before(function (done) {
            // Create 12 fake old releases (prefixed with 0 so they sort before real ones)
            // After deploying: 12 fake + 1 existing + 1 new = 14 total
            // Clean-up removes the 4 oldest, leaving 10
            for (var i = 0; i < 12; i++) {
                remote('mkdir -p ' + DEPLOY_TO + '/releases/0000-fake-release-' + String(i).padStart(2, '0'));
            }

            // Deploy again
            var shipit = new Shipit({environment: 'production'});
            require('./fixtures/shipitfile')(shipit);
            shipit.initialize();
            shipit.start('deploy', done);
        });

        it('keeps no more than 10 releases', function () {
            var count = remote('ls ' + DEPLOY_TO + '/releases | wc -l');
            assert.equal(count, '10');
        });

        it('removes the oldest releases first', function () {
            var releases = remote('ls ' + DEPLOY_TO + '/releases');
            // The 4 oldest fakes (00-03) should be gone
            assert.ok(!releases.includes('0000-fake-release-00'), 'Expected oldest fake release to be removed');
            assert.ok(!releases.includes('0000-fake-release-03'), 'Expected 4th oldest fake release to be removed');
            // The 8 newest fakes (04-11) should still be present
            assert.ok(releases.includes('0000-fake-release-04'), 'Expected 5th fake release to be kept');
            assert.ok(releases.includes('0000-fake-release-11'), 'Expected newest fake release to be kept');
        });

        it('keeps the current symlink valid', function () {
            remote('test -d ' + DEPLOY_TO + '/current');
        });
    });
});
