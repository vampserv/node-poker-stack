module.exports = function(app){
    return new ChatRemote(app, app.get('chatService'));
};

var ChatRemote = function(app, chatService){
    this.app = app;
    this.chatService = chatService;
};

/**
 *	Add player into channel
 */
ChatRemote.prototype.addToChannel = function(uid, cid, cb){
    this.chatService.addToChannel(uid, cid, cb);
};

/**
 *	Add player record
 */
ChatRemote.prototype.add = function(uid, cid, cb){
    this.chatService.add(uid, cid, cb);
};

/**
 *	Get members in a channel
 */
ChatRemote.prototype.getMembers = function(cid, cb){
    this.chatService.getMembers(cid, cb);
};

/**
 * leave Channel
 * uid
 * cid
 */
ChatRemote.prototype.leave = function(uid, cid, cb){
    this.chatService.leave(uid, cid);
    cb();
};

/**
 * kick out user
 *
 */
ChatRemote.prototype.disconnect = function(uid, cb){
    this.chatService.disconnect(uid);
    cb();
};
