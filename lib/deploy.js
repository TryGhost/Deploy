const path = require('path');

// npm and yarn ship with Node, so they are always present on a target server.
// pnpm is not bundled — a server deploying with packageManager: 'pnpm' must
// provide it (e.g. via Corepack). The production flag also differs: npm and
// yarn take --production, pnpm takes --prod.
const PACKAGE_MANAGERS = {
    yarn: {install: 'yarn install', productionFlag: '--production'},
    npm: {install: 'npm install', productionFlag: '--production'},
    pnpm: {install: 'pnpm install', productionFlag: '--prod'}
};

function resolvePackageManager(config) {
    if (config.packageManager) {
        if (!PACKAGE_MANAGERS[config.packageManager]) {
            throw new Error(
                'Unknown packageManager "' + config.packageManager + '". Expected one of: '
                + Object.keys(PACKAGE_MANAGERS).join(', ') + '.'
            );
        }

        return config.packageManager;
    }

    // Backwards compatibility: the legacy boolean `npm` flag selected npm, and
    // yarn was the default for everything else.
    return (config.npm === true) ? 'npm' : 'yarn';
}

function buildInstallCommand(config) {
    const packageManager = PACKAGE_MANAGERS[resolvePackageManager(config)];

    if (config.allDeps) {
        return packageManager.install;
    }

    return packageManager.install + ' ' + packageManager.productionFlag;
}

module.exports = function (shipit) {
    shipit.task('deploy', async () => {
        const rsyncFrom = shipit.config.rsyncFrom || shipit.config.workspace;
        const uploadDirPath = path.resolve(rsyncFrom, shipit.config.dirToCopy || '');
        const releasesPath = path.resolve(shipit.config.deployTo, 'releases');
        const releasePath = path.resolve(releasesPath, new Date().toISOString().replace(/:/g, '_').replace(/\./g, '_'));
        const currentPath = path.resolve(shipit.config.deployTo, 'current');
        const options = (shipit.config.deploy && shipit.config.deploy.remoteCopy) || {rsync: '--del'};
        // Resolved before any remote mutation so an unknown packageManager fails
        // the deploy up front rather than after the release has been copied.
        const installCommand = buildInstallCommand(shipit.config);

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

        await shipit.remote('cd ' + currentPath + ' && ' + installCommand);

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
