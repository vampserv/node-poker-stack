module.exports = function(app){
    return new Remote(app);
};
var Remote = function(app){
    this.app = app;
    this.tableService = app.get('tableService');
};
var remote = Remote.prototype;

/**
 * Remove member/player from table
 *
 * @param {string} uid user id
 * @param {string} sid server id
 * @param {string} tid channel id
 * @param {function} cb callback
 *
 */
remote.removeMember = function(uid, sid, tid, cb){
    this.tableService.removeMember(tid, uid, cb);
};

