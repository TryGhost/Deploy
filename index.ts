import deploy from './lib/deploy';

type Shipit = Parameters<typeof deploy>[0];

function plugin(shipit: Shipit): void {
    deploy(shipit);
}

plugin.getServerList = function getServerList(): string | string[] {
    const deployUser = process.env.DEPLOY_USER;
    const deployServers = process.env.DEPLOY_SERVERS;

    try {
        const parsedServers = JSON.parse(deployServers as string) as string[];
        return parsedServers.map((item) => `${deployUser}@${item}`);
    } catch {
        return `${deployUser}@${deployServers}`;
    }
};

export = plugin;
