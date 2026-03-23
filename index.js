module.exports = function (shipit) {
    require('./lib/deploy')(shipit);
};

module.exports.getServerList = function () {
    const deployUser = process.env.DEPLOY_USER;
    const deployServers = process.env.DEPLOY_SERVERS;

    try {
        const parsedServers = JSON.parse(deployServers);
        return parsedServers.map(item => deployUser + '@' + item);
    } catch (e) {
        return deployUser + '@' + deployServers;
    }
};
