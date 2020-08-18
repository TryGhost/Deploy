const chalk = require('chalk');
const _ = require('lodash');
const path = require('path');
const Promise = require('bluebird');

function deploy(shipit) {
    shipit.task('deploy', async () => {
        let rsyncFrom = shipit.config.rsyncFrom || shipit.config.workspace;
        let uploadDirPath = path.resolve(rsyncFrom, shipit.config.dirToCopy || '');
        let releasesPath = path.resolve(shipit.config.deployTo, 'releases');
        let releasePath = path.resolve(releasesPath, new Date().toISOString());
        let currentPath = path.resolve(shipit.config.deployTo, 'current');
        let options = _.get(shipit.config, 'deploy.remoteCopy') || {rsync: '--del'};

        shipit.log('Deploying project to servers...');

        await shipit.remote('mkdir -p ' + releasesPath);
        await shipit.remoteCopy(uploadDirPath + '/', releasePath, options);
        shipit.log(chalk.green('Finished copying release'));

        // ln -nfs releases/<latest release> current
        await shipit.remote('ln -nfs ' + releasePath + ' ' + currentPath);
        shipit.log(chalk.green('current directory linked to release'));

        await Promise.mapSeries(shipit.config.sharedLinks, async (link) => {
            let sharedLinkPath = path.resolve(shipit.config.deployTo, 'shared', link.name);
            let currentLinkPath = path.resolve(currentPath, link.name);

            // if directory: mkdir -p current/tmp
            if (link.type === 'directory') {
                await shipit.remote('mkdir -p ' + sharedLinkPath);
            }

            // ln -nfs shared/link-src current/link-target
            shipit.log(chalk.green('Linking from ' + sharedLinkPath + ' to ' + currentLinkPath + ':'));
            await shipit.remote('ln -nfs ' + sharedLinkPath + ' ' + currentLinkPath);
        });

        shipit.log(chalk.green('All links created.'));

        let command = (shipit.config.npm === true) ? 'npm install' : 'yarn install';

        if (!shipit.config.allDeps) {
            command += ' --production';
        }

        await shipit.remote(command, {cwd: currentPath});
        shipit.log(chalk.green('Dependency installation finished.'));

        let currentTmpPath = path.resolve(currentPath, 'tmp');
        let currentPublicPath = path.resolve(currentPath, 'public');
        let restartFile = path.resolve(currentTmpPath, 'restart.txt');

        await shipit.remote('mkdir -p ' + currentTmpPath);
        await shipit.remote('mkdir -p ' + currentPublicPath);
        await shipit.remote('touch ' + restartFile);

        shipit.log(chalk.green('Deployed 🎉!'));
        shipit.emit('deployed');
    });

    // Register a default task
    shipit.task('default', ['deploy']);
}

module.exports = deploy;
