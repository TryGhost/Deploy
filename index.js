module.exports = function (shipit) {
    require('./lib/deploy')(shipit);
};

module.exports.getServerList = function () {
    let deployUser = process.env.DEPLOY_USER;
    let deployServers = process.env.DEPLOY_SERVERS;

    try {
        let parsedServers = JSON.parse(deployServers);
        return parsedServers.map(item => deployUser + '@' + item);
    } catch (e) {
        return deployUser + '@' + deployServers;
    }
};
