const path = require('path');

module.exports = function (shipit) {
    shipit.task('deploy', async () => {
        const rsyncFrom = shipit.config.rsyncFrom || shipit.config.workspace;
        const uploadDirPath = path.resolve(rsyncFrom, shipit.config.dirToCopy || '');
        const releasesPath = path.resolve(shipit.config.deployTo, 'releases');
        const releasePath = path.resolve(releasesPath, new Date().toISOString().replace(/:/g, '_').replace(/\./g, '_'));
        const currentPath = path.resolve(shipit.config.deployTo, 'current');
        const options = (shipit.config.deploy && shipit.config.deploy.remoteCopy) || {rsync: '--del'};

        shipit.log('Deploying project to servers...');

        await shipit.remote('mkdir -p ' + releasesPath);
        await shipit.remoteCopy(uploadDirPath + '/', releasePath, options);
        await shipit.remote('ln -nfs ' + releasePath + ' ' + currentPath);

        for (const link of shipit.config.sharedLinks) {
            const targetName = link.target || link.name;

            const sharedLinkPath = path.resolve(shipit.config.deployTo, 'shared', link.name);
            const currentLinkPath = path.resolve(currentPath, targetName);

            if (link.type === 'directory') {
                await shipit.remote('mkdir -p ' + sharedLinkPath);
            }

            await shipit.remote('ln -nfs ' + sharedLinkPath + ' ' + currentLinkPath);
        }

        let command = (shipit.config.npm === true) ? 'npm install' : 'yarn install';

        if (!shipit.config.allDeps) {
            command += ' --production';
        }

        await shipit.remote('cd ' + currentPath + ' && ' + command);

        const currentTmpPath = path.resolve(currentPath, 'tmp');
        const currentPublicPath = path.resolve(currentPath, 'public');
        const restartFile = path.resolve(currentTmpPath, 'restart.txt');

        await shipit.remote('mkdir -p ' + currentTmpPath);
        await shipit.remote('mkdir -p ' + currentPublicPath);

        if (process.env.NO_RESTART === 'false') {
            await shipit.remote('touch ' + restartFile);
        }

        // Clean-up old releases -- leave no more than 10
        await shipit.remote('cd ' + releasesPath + ' && ls -1d */ | head -n -10 | xargs rm -rf');

        shipit.log('Deployed 🎉!');
        shipit.emit('deployed');
    });

    // Register a default task
    shipit.task('default', ['deploy']);
};
