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
                return shipit.remoteCopy(uploadDirPath + '/', releasePath, options)
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

    function linkModules(){
        var sharedNodeModulesPath = path.resolve(shipit.config.deployTo, 'shared/node_modules');
        var currentNodeModulesPath = path.resolve(currentPath, 'node_modules');

        // mkdir -p shared/node_modules
        // ln -nfs shared/node_modules current/node_modules
        return shipit.remote('mkdir -p ' + sharedNodeModulesPath)
            .then(function () {
                return shipit.remote('ln -nfs ' + sharedNodeModulesPath + ' ' + currentNodeModulesPath);
            })
            .then(function () {
                return shipit.log(chalk.green('node_modules linked to release.'));
            });
    }

    function linkConfig(){
        var sharedConfigPath = path.resolve(shipit.config.deployTo, 'shared/config.js');
        var currentConfigPath = path.resolve(currentPath, 'config.js');
        
        // ln -nfs shared/config.js current/config.js
        return shipit.remote('ln -nfs ' + sharedConfigPath + ' ' + currentConfigPath)
            .then(function () {
                return shipit.log(chalk.green('config.js linked to release.'));
            });
    }

    function npmInstall(){
        // npm install
        return shipit.remote('npm install', {cwd: currentPath})
            .then(function () {
                return shipit.log(chalk.green('npm install finished.'));
            });
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
            .then(linkModules)
            .then(linkConfig)
            .then(npmInstall)
            .then(restart)
            .then(finished);
    });

}

module.exports = deploy;
