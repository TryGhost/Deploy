var chalk = require('chalk');
var _     = require('lodash');
var path = require('path');
var Promise = require('bluebird');

function deploy (shipit) {
    var releasePath;
    var releasesPath;
    var currentPath;
    var uploadDirPath;

    function init() {
        // configure paths used for deployment
        var rsyncFrom = shipit.config.rsyncFrom || shipit.config.workspace;
        uploadDirPath = path.resolve(rsyncFrom, shipit.config.dirToCopy || '');
        releasesPath = path.resolve(shipit.config.deployTo, 'releases');
        releasePath = path.resolve(releasesPath, new Date().toISOString());
        currentPath = path.resolve(shipit.config.deployTo, 'current');
        return Promise.resolve();
    }

    function remoteCopy() {
        var options = _.get(shipit.config, 'deploy.remoteCopy') || {rsync: '--del'};
        
        shipit.log('Copy project to remote servers.');

        // mkdir -p releases
        // rsync
        return shipit.remote('mkdir -p ' + releasesPath)
            .then(function () {
                return shipit.remoteCopy(uploadDirPath + '/', releasePath, options);
            })
            .then(function () {
                return shipit.log(chalk.green('Finished copy.'));
            });
    }

    function linkCurrent(){
        // ln -nfs releses/<latest release> current
        return shipit.remote('ln -nfs ' + releasePath + ' ' + currentPath)
            .then(function () {
                return shipit.log(chalk.green('current linked to release.'));
            });
    }

    function linkShared(){
        return Promise.mapSeries(shipit.config.sharedLinks, function (link) {
            var sharedLinkPath = path.resolve(shipit.config.deployTo, 'shared', link.name);
            var currentLinkPath = path.resolve(currentPath, link.name);
            return Promise.resolve().then(function () {
                // if directory: mkdir -p current/tmp
                if (link.type === 'directory') {
                    return shipit.remote('mkdir -p ' + sharedLinkPath);
                }
            }).then(function () {
                // ln -nfs shared/link-src current/link-target
                return shipit.remote('ln -nfs ' + sharedLinkPath + ' ' + currentLinkPath);
            }).then(function () {
                return shipit.log(chalk.green('Link from ' + sharedLinkPath + ' to ' + currentLinkPath + ' created.'));
            });
        }).then(function () {
            return shipit.log(chalk.green('All links created.'));
        });
    }

    function installDependencies(){
        // yarn install
        var command = ''
        if (shipit.config.yarn === true) {
            command = 'yarn install';
        } else {
            command = 'npm install';
        }

        // npm install
        return shipit.remote(command, {cwd: currentPath})
            .then(function () {
                return shipit.log(chalk.green('Dependency installation finished.'));
            });
    }

    function build(){
        if (shipit.config.buildCommand) {
            return shipit.remote(shipit.config.buildCommand, {cwd: currentPath})
                .then(function () {
                    return shipit.log(chalk.green('Build finished.'));
                });
        }
        return Promise.resolve();
    }

    function restart(){
        var currentTmpPath = path.resolve(currentPath, 'tmp');
        var currentPublicPath = path.resolve(currentPath, 'public');
        var restartFile = path.resolve(currentTmpPath, 'restart.txt');

        // mkdir -p current/tmp
        // mkdir -p current/public
        // touch current/tmp/restart.txt
        return shipit.remote('mkdir -p ' + currentTmpPath)
            .then(function () {
                return shipit.remote('mkdir -p ' + currentPublicPath);
            }).then(function () {
                return shipit.remote('touch ' + restartFile)
            }).then(function () {
                return shipit.log(chalk.green('Restart initialized.'));
            });
    }

    function finished() {
        shipit.log(chalk.green('Deployed 🎉!'));
        // emit deployed event which can be used to trigger followup tasks
        return shipit.emit('deployed');
    }

    // register deploy task with shipit
    shipit.task('deploy', function () {
        return init()
            .then(remoteCopy)
            .then(linkCurrent)
            .then(linkShared)
            .then(installDependencies)
            .then(build)
            .then(restart)
            .then(finished);
    });

}

module.exports = deploy;
