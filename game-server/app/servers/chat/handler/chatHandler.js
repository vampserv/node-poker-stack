var UserStore = require('../../../persistence/users');
var dispatcher = require('../../../util/dispatcher');

module.exports = function(app){
    return new Handler(app, app.get('chatService'));
};
var Handler = function(app, chatService){
    this.app = app;
    this.chatService = chatService;
};
var handler = Handler.prototype;

/**
 * Send messages to users in the channel
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
handler.sendMessage = function(msg, session, next){
    var me = this;
    var tid = session.get('tid');
    var channelService = this.app.get('channelService');
    UserStore.getByAttr('id', session.uid, false, function(e, user){
        if(!user){
            next(null, {
                code  : 500,
                error : 'user-not-exist'
            });
            return;
        }
        // target is all users
        if(msg.target == 'table'){
            var channel = channelService.getChannel(tid, true);
            msg.target = '*';
            channel.pushMessage({
                route    : 'onChat',
                msg      : msg.content,
                username : user.username,
                target   : msg.target
            });
            next(null, {
                code  : 200,
                route : msg.route
            });
        }else{
            // target is specific user
            me.chatService.pushByPlayerName(msg.target, {
                username : user.username,
                msg      : msg.content
            }, function(e){
                if(e){
                    return next(null, {
                        code  : 500,
                        error : e
                    });
                }
                next(null, {
                    code  : 200,
                    route : msg.route
                });
            });
        }
    });
};

/**
 * Get friend list
 *
 * @param {Object} msg game parameters from client
 * @param {Object} session
 * @param  {Function} next next step callback
 *
 */
handler.getFriends = function(msg, session, next){
    this.chatService.getFriendList(session.uid, function(e, friends){
        if(e){
            return next(null, {
                code  : 500,
                error : e
            });
        }
        next(null, {
            code    : 200,
            route   : msg.route,
            friends : friends
        });
    });
};