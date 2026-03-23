var Shipit = require('shipit-cli');
var {execSync} = require('child_process');
var assert = require('assert');

var DEPLOY_TO = '/opt/deploy_to';

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
        var shipit = new Shipit({environment: 'production'});
        require('./fixtures/shipitfile')(shipit);
        shipit.initialize();
        shipit.start('deploy', done);
    });

    describe('Release structure', function () {
        it('creates a releases directory', function () {
            remote('test -d ' + DEPLOY_TO + '/releases');
        });

        it('creates exactly one release', function () {
            var count = remote('ls ' + DEPLOY_TO + '/releases | wc -l');
            assert.equal(count, '1');
        });
    });

    describe('Current symlink', function () {
        it('creates a current symlink', function () {
            remote('test -L ' + DEPLOY_TO + '/current');
        });

        it('points into the releases directory', function () {
            var target = remote('readlink ' + DEPLOY_TO + '/current');
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
            var content = remote('cat ' + DEPLOY_TO + '/current/package.json');
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
});
