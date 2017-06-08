var chalk = require('chalk');
var _     = require('lodash');
var path = require('path');
var Promise = require('bluebird');

function deploy (shipit) {
    console.log("--- start ---");
    var releasePath;
    var currentReleasePath;
    var uploadDirPath;

    function init() {
        var rsyncFrom = shipit.config.rsyncFrom || shipit.config.workspace;
        uploadDirPath = path.resolve(rsyncFrom, shipit.config.dirToCopy || '');
        releasesPath = path.resolve(shipit.config.deployTo, 'releases');
        releasePath = path.resolve(releasesPath, new Date().toISOString());
        currentReleasePath = path.resolve(shipit.config.deployTo, 'current');
        return Promise.resolve();
    }

    function remoteCopy() {
        var options = _.get(shipit.config, 'deploy.remoteCopy') || {rsync: '--del'};
        
        shipit.log('Copy project to remote servers.');
        // create releasePath
        // 
        console.log(uploadDirPath);
        console.log(shipit.config.deployTo);
        console.log(releasePath);
        return shipit.remote('mkdir -p ' + releasesPath)
            .then(function () {
                return shipit.remoteCopy(uploadDirPath + '/', releasePath, options)
            })
            .then(function () {
                return shipit.log(chalk.green('Finished copy.'));
            });
    }

    function linkCurrent(){
        // ln -nfs $DEST_PATH $APP_PATH/current
        // var rsyncFrom = shipit.config.rsyncFrom || shipit.config.workspace;
        // var uploadDirPath = path.resolve(rsyncFrom, shipit.config.dirToCopy || '');
        return shipit.remote('ln -nfs ' + releasePath + ' ' + currentReleasePath);
    }

    function linkModules(){
        var sharedNodeModulesPath = path.resolve(shipit.config.deployTo, 'shared/node_modules');
        var currentNodeModulesPath = path.resolve(currentReleasePath, 'node_modules');
        // ln -nfs $DEST_PATH $APP_PATH/current
        return shipit.remote('mkdir -p ' + sharedNodeModulesPath)
            .then(function () {
                return shipit.remote('ln -nfs ' + sharedNodeModulesPath + ' ' + currentNodeModulesPath);
            });
    }

    function linkConfig(){
        var sharedConfigPath = path.resolve(shipit.config.deployTo, 'shared/config.js');
        var currentConfigPath = path.resolve(currentReleasePath, 'config.js');
        
        return shipit.remote('ln -nfs ' + sharedConfigPath + ' ' + currentConfigPath);
    }

    function npmInstall(){
        return shipit.remote('npm install', {cwd: currentReleasePath});
    }

    function restart(){
        var currentTmpPath = path.resolve(currentReleasePath, 'tmp');
        var currentPublicPath = path.resolve(currentReleasePath, 'public');
        var restartFile = path.resolve(currentTmpPath, 'restart.txt');

        return shipit.remote('mkdir -p ' + currentTmpPath)
            .then(function () {
                return shipit.remote('mkdir -p ' + currentPublicPath);
            }).then(function () {
                return shipit.remote('touch ' + restartFile);
            });
    }

    function finished() {
        return shipit.log(chalk.green('Deployed 🎉!'));
    }

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
