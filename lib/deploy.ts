import * as path from 'node:path';
import type { ExecOptions } from 'node:child_process';

/** A shipit task function (the deploy task is async; shipit ignores the result). */
type ShipitTask = () => void | Promise<void>;

/** Package managers the deploy can run on the remote server. */
type PackageManager = 'yarn' | 'npm' | 'pnpm';

interface PackageManagerSpec {
    install: string;
    productionFlag: string;
}

// npm is bundled with Node, so it is always present on a target server. yarn is
// not part of Node but is commonly preinstalled (e.g. in the official Node
// Docker images); pnpm usually is not. Whichever manager a deploy selects must
// be available on the server or the install step fails. The production flag
// also differs: npm and yarn take --production, pnpm takes --prod.
const PACKAGE_MANAGERS: Record<PackageManager, PackageManagerSpec> = {
    yarn: { install: 'yarn install', productionFlag: '--production' },
    npm: { install: 'npm install', productionFlag: '--production' },
    pnpm: { install: 'pnpm install', productionFlag: '--prod' },
};

/** A path on the server shared across releases and symlinked into `current`. */
interface SharedLink {
    name: string;
    /** Where to link it inside the release; defaults to `name`. */
    target?: string;
    type: 'directory' | 'file';
}

// Options for shipit's `remoteCopy`. This is shipit's own rsync wrapper config,
// not child_process options — @types/shipit-cli mistypes it as ExecOptions, so
// it's the one method shape we keep local rather than import.
interface RemoteCopyOptions {
    rsync?: string;
    [key: string]: unknown;
}

/** The `shipit.config` fields this plugin reads. */
interface DeployConfig {
    deployTo: string;
    workspace?: string;
    rsyncFrom?: string;
    dirToCopy?: string;
    sharedLinks: SharedLink[];
    deploy?: { remoteCopy?: RemoteCopyOptions };
    /** Package manager for the remote install: 'yarn' (default) | 'npm' | 'pnpm'. */
    packageManager?: PackageManager;
    /** Legacy flag — equivalent to `packageManager: 'npm'`. */
    npm?: boolean;
    /** Install dev dependencies too (drops the production-only flag). */
    allDeps?: boolean;
}

/**
 * The slice of the Shipit instance this plugin uses. Defined locally rather than
 * pulled from `@types/shipit-cli`: those types are published only for
 * shipit-cli v4 (the runtime is v5), so depending on them risks contract drift
 * — and these shapes are trivial. `remote`'s options reuse Node's `ExecOptions`
 * (a correct, stable upstream type); `remoteCopy`'s options stay local because
 * shipit takes rsync options, not child_process ones (see RemoteCopyOptions).
 * The remote-command results aren't read, so they're typed `unknown`.
 */
interface Shipit {
    config: Record<string, unknown>;
    task(name: string, task: ShipitTask | string[]): void;
    remote(command: string, options?: ExecOptions): PromiseLike<unknown>;
    remoteCopy(src: string, dest: string, options?: RemoteCopyOptions): PromiseLike<unknown>;
    log(message: unknown): void;
    emit(event: string): void;
}

function resolvePackageManager(config: DeployConfig): PackageManager {
    // Read as unknown: the value comes from consumer config, so an explicitly
    // set but invalid value (including an empty string) must fail fast rather
    // than fall through. An unset packageManager (undefined/null) uses the
    // legacy selector below.
    const requested: unknown = config.packageManager;
    if (requested !== undefined && requested !== null) {
        if (typeof requested !== 'string' || !(requested in PACKAGE_MANAGERS)) {
            throw new Error(
                `Unknown packageManager "${String(requested)}". Expected one of: ${Object.keys(PACKAGE_MANAGERS).join(', ')}.`,
            );
        }
        return requested as PackageManager;
    }

    // Backwards compatibility: the legacy boolean `npm` flag selected npm, and
    // yarn was the default for everything else.
    return config.npm === true ? 'npm' : 'yarn';
}

function buildInstallCommand(config: DeployConfig): string {
    const packageManager = PACKAGE_MANAGERS[resolvePackageManager(config)];

    if (config.allDeps) {
        return packageManager.install;
    }

    return `${packageManager.install} ${packageManager.productionFlag}`;
}

function deploy(shipit: Shipit): void {
    shipit.task('deploy', async () => {
        const config = shipit.config as unknown as DeployConfig;
        const rsyncFrom = config.rsyncFrom || config.workspace;
        const uploadDirPath = path.resolve(rsyncFrom as string, config.dirToCopy || '');
        const releasesPath = path.resolve(config.deployTo, 'releases');
        const releasePath = path.resolve(
            releasesPath,
            new Date().toISOString().replace(/:/g, '_').replace(/\./g, '_'),
        );
        const currentPath = path.resolve(config.deployTo, 'current');
        const options = (config.deploy && config.deploy.remoteCopy) || { rsync: '--del' };
        // Resolved before any remote mutation so an unknown packageManager fails
        // the deploy up front rather than after the release has been copied.
        const installCommand = buildInstallCommand(config);

        shipit.log('Deploying project to servers...');

        await shipit.remote(`mkdir -p ${releasesPath}`);
        await shipit.remoteCopy(`${uploadDirPath}/`, releasePath, options);
        await shipit.remote(`ln -nfs ${releasePath} ${currentPath}`);

        for (const link of config.sharedLinks) {
            const targetName = link.target || link.name;

            const sharedLinkPath = path.resolve(config.deployTo, 'shared', link.name);
            const currentLinkPath = path.resolve(currentPath, targetName);

            if (link.type === 'directory') {
                await shipit.remote(`mkdir -p ${sharedLinkPath}`);
            }

            await shipit.remote(`ln -nfs ${sharedLinkPath} ${currentLinkPath}`);
        }

        await shipit.remote(`cd ${currentPath} && ${installCommand}`);

        const currentTmpPath = path.resolve(currentPath, 'tmp');
        const currentPublicPath = path.resolve(currentPath, 'public');
        const restartFile = path.resolve(currentTmpPath, 'restart.txt');

        await shipit.remote(`mkdir -p ${currentTmpPath}`);
        await shipit.remote(`mkdir -p ${currentPublicPath}`);

        if (process.env.NO_RESTART === 'false') {
            await shipit.remote(`touch ${restartFile}`);
        }

        // Clean-up old releases -- leave no more than 10
        await shipit.remote(`cd ${releasesPath} && ls -1d */ | head -n -10 | xargs rm -rf`);

        shipit.log('Deployed 🎉!');
        shipit.emit('deployed');
    });

    // Register a default task
    shipit.task('default', ['deploy']);
}

export = deploy;
