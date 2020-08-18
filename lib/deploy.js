const _ = require('lodash');
const path = require('path');
const Promise = require('bluebird');

module.exports = function (shipit) {
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

        // ln -nfs releases/<latest release> current
        await shipit.remote('ln -nfs ' + releasePath + ' ' + currentPath);

        await Promise.mapSeries(shipit.config.sharedLinks, async (link) => {
            let sharedLinkPath = path.resolve(shipit.config.deployTo, 'shared', link.name);
            let currentLinkPath = path.resolve(currentPath, link.name);

            // if directory: mkdir -p current/tmp
            if (link.type === 'directory') {
                await shipit.remote('mkdir -p ' + sharedLinkPath);
            }

            // ln -nfs shared/link-src current/link-target
            await shipit.remote('ln -nfs ' + sharedLinkPath + ' ' + currentLinkPath);
        });

        let command = (shipit.config.npm === true) ? 'npm install' : 'yarn install';

        if (!shipit.config.allDeps) {
            command += ' --production';
        }

        await shipit.remote(command, {cwd: currentPath});

        let currentTmpPath = path.resolve(currentPath, 'tmp');
        let currentPublicPath = path.resolve(currentPath, 'public');
        let restartFile = path.resolve(currentTmpPath, 'restart.txt');

        await shipit.remote('mkdir -p ' + currentTmpPath);
        await shipit.remote('mkdir -p ' + currentPublicPath);
        await shipit.remote('touch ' + restartFile);

        shipit.log('Deployed 🎉!');
        shipit.emit('deployed');
    });

    // Register a default task
    shipit.task('default', ['deploy']);
};
