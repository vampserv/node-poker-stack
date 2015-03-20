module.exports = function(opts) {
    return new Module(opts);
}

var testMsg = 'a default message';

var moduleId = "timeReport";
module.exports.moduleId = moduleId;

var Module = function(opts) {
    this.app = opts.app;
    this.type = opts.type || 'pull';
    this.interval = opts.interval || 5;
}

Module.prototype.monitorHandler = function(agent, msg, cb) {
    console.log(this.app.getServerId() + '' + msg);
    var serverId = agent.id;
    var time = new Date(). toString();

    agent.notify(moduleId, {serverId: serverId, time: time});
}

Module.prototype.masterHandler = function(agent, msg) {
    if(! msg) {
        agent.notifyAll(moduleId, testMsg);
        return;
    }

    console.log(msg);
    var timeData = agent.get(moduleId);
    if(! timeData) {
        timeData = {};
        agent.set(moduleId, timeData);
    }
    timeData[msg.serverId] = msg.time;
}


Module.prototype.clientHandler = function(agent, msg, cb) {
    cb(null, agent.get(moduleId));
}
