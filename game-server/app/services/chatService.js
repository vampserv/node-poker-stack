var UserStore = require('../persistence/users');
var dispatcher = require('../util/dispatcher');

var ChatService = function(app) {
    this.app = app;
    this.uidMap = {};
    this.nameMap = {};
    this.channelMap = {};
};

module.exports = ChatService;

/**
 * Add player into a channel
 *
 * @param {String} uid         user id
 * @param {String} cid channel id
 * @return {Number} see code.js
 */
ChatService.prototype.addToChannel = function(uid, cid, cb){
    var me = this;
    UserStore.getByAttr('id', uid, false, function(e, user){
        if(e){
            return cb(e);
        }
        var sid = getSidByUid(uid, me.app);
        if(!sid){
            return cb('invalid-connector-server');
        }
        if(checkDuplicate(me, uid, cid)){
            return cb();
        }
        var channel = me.app.get('channelService').getChannel(cid, true);
        if(!channel){
            return cb('invalid-channel');
        }
        channel.add(uid, sid);
        addRecord(me, uid, user.username, sid, cid);
        cb();
    });
};

/**
 * Add player record
 *
 * @param {String} uid user id
 */
ChatService.prototype.add = function(uid, cb){
    var me = this;
    UserStore.getByAttr('id', uid, false, function(e, user){
        if(e){
            return cb(e);
        }
        var sid = getSidByUid(uid, me.app);
        if(!sid){
            return cb('invalid-connector-server');
        }
        addRecord(me, uid, user.username, sid);
        cb();
    });
};

/**
 * User leaves the channel
 *
 * @param  {String} uid         user id
 * @param  {String} cid channel id
 */
ChatService.prototype.leave = function(uid, cid) {
    var record = this.uidMap[uid];
    var channel = this.app.get('channelService').getChannel(cid, true);
    if(channel && record) {
        channel.leave(uid, record.sid);
    }
    removeRecord(this, uid, cid);
};

/**
 * Disconnect user from all channels in chat service.
 * This operation would remove the user from all channels and
 * clear all the records of the user.
 *
 * @param  {String} uid user id
 */
ChatService.prototype.disconnect = function(uid){
    var cids = this.channelMap[uid];
    var record = this.uidMap[uid];
    if(cids && record){
        // remove user from channels
        var channel;
        for(var name in cids){
            channel = this.app.get('channelService').getChannel(name);
            if(channel){
                channel.leave(uid, record.sid);
            }
        }
    }
    clearRecords(this, uid);
};

/**
 *	Get friend list
 * @param  {string}   uid user id
 * @param  {Function} cb          callback function
 */
ChatService.prototype.getFriendList = function(uid, cb){
    var me = this;
    UserStore.getByAttr('id', uid, {
        getFullEntity : true
    }, function(e, user){
        if(e){
            return cb(e);
        }
        user.friends = user.friends || [];
        for(var i=0;i<user.friends.length;++i){
            user.friends[i].online = me.uidMap[user.friends[i].id] ? true : false;
        }
        cb(null, user.friends);
    });
};

/**
 * Push message by the specified channel
 *
 * @param  {String}   cid channel id
 * @param  {Object}   msg         message json object
 * @param  {Function} cb          callback function
 */
ChatService.prototype.pushByChannel = function(cid, msg, cb){
    var channel = this.app.get('channelService').getChannel(cid);
    if(!channel){
        cb(new Error('channel ' + cid + ' doses not exist'));
        return;
    }
    channel.pushMessage('onChat', msg, cb);
};

/**
 * Push message to the specified player
 *
 * @param  {String}   username player's role name
 * @param  {Object}   msg        message json object
 * @param  {Function} cb         callback
 */
ChatService.prototype.pushByPlayerName = function(username, msg, cb){
    var record = this.nameMap[username];
    if(!record){
        cb('user-not-online');
        return;
    }
    this.app.get('channelService').pushMessageByUids('onUserChat', msg, [{uid: record.uid, sid: record.sid}], cb);
};

/**
 * Push message to the specified player
 *
 * @param  {String}   uid player's user id
 * @param  {Object}   msg        message json object
 * @param  {Function} cb         callback
 */
ChatService.prototype.pushByPlayerId = function(uid, msg, cb){
    var record = this.uidMap[uid];
    if(!record){
        cb('user-not-online');
        return;
    }
    this.app.get('channelService').pushMessageByUids('onUserChat', msg, [{uid: record.uid, sid: record.sid}], cb);
};

/**
 * Check whether the user is already in the channel
 */
var checkDuplicate = function(service, uid, cid) {
    return !!service.channelMap[uid] && !!service.channelMap[uid][cid];
};

/**
 * Add records for the specified user
 */
var addRecord = function(service, uid, name, sid, cid){
    var record = {uid: uid, name: name, sid: sid};
    service.uidMap[uid] = record;
    service.nameMap[name] = record;
    var item = service.channelMap[uid];
    if(!item){
        item = service.channelMap[uid] = {};
    }
    if(cid){
        item[cid] = 1;
    }
};

/**
 * Remove records for the specified user and channel pair
 */
var removeRecord = function(service, uid, cid) {
    delete service.channelMap[uid][cid];
//    if(objLen(service.channelMap[uid])){
//        return;
//    }
//    // if user not in any channel then clear his records
//    clearRecords(service, uid);
};

/**
 * Clear all records of the user
 */
var clearRecords = function(service, uid) {
    delete service.channelMap[uid];
    var record = service.uidMap[uid];
    if(!record) {
        return;
    }
    delete service.uidMap[uid];
    delete service.nameMap[record.name];
};

/**
 * Get the connector server id associated with the uid
 */
var getSidByUid = function(uid, app) {
    var connector = dispatcher.dispatch(uid, app.getServersByType('connector'));
    if(connector) {
        return connector.id;
    }
    return null;
};

function objLen(obj){
    if(!obj) {
        return 0;
    }
    var size = 0;
    for(var f in obj) {
        if(obj.hasOwnProperty(f)) {
            size++;
        }
    }
    return size;
}