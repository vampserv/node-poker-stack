var logger = require('pomelo-logger').getLogger('con-log', __filename);

module.exports = function(app){
	return new Handler(app);
};
var Handler = function(app){
    this.app = app;
};
var handler = Handler.prototype;

/**
 * Register user.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 */
handler.register = function(msg, session, next){
    this.app.rpc.game.authRemote.register(session, msg, function(e, user){
        if(e){
            next(null, {
                code  : 500,
                error : e
            });
        }else{
            next(null, {
                code : 201
            });
        }
    });
};

/**
 * Connect to the server
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 */
handler.connect = function(msg, session, next){
    var me = this;
    var sessionService = me.app.get('sessionService');
    me.app.rpc.game.authRemote.auth(session, msg, function(e, user, token){
        if(!user){
            next(null, {
                code  : 401,
                error : e
            });
            return;
        }
        // duplicate log in
        if(!! sessionService.getByUid(user.id)){
            return next(null, {
                code  : 500,
                error : 'duplicate-session'
            });
        }
        session.bind(user.id, function(e){
            if(e){
                console.error('error-binding-user', e);
            }
            session.set('username', user.username);
            session.on('closed', onUserLeave.bind(null, me.app));
            session.pushAll(function(e){
                if(e){
                    console.error('set username for session service failed! error is : %j', e.stack);
                }
            });
            // add user to chat service
            me.app.rpc.chat.chatRemote.add(session, session.uid, function(e){
                if(e){
                    return next(null, {
                        code  : 500,
                        error : e
                    });
                }
                next(null, {
                    code  : 200,
                    token : token,
                    user  : user
                });
            });
        });
    });
};
/**
 * User log out handler
 *
 * @param {Object} app current application
 * @param {Object} session current session object
 *
 */
var onUserLeave = function(app, session){
    if(!session || !session.uid || !session.get('tid')){
        return;
    }
    if(session.get('tid')){
        app.rpc.chat.chatRemote.disconnect(session, session.uid, function(){});
        app.rpc.game.tableRemote.removeMember(session, session.uid, app.get('serverId'), session.get('tid'), function(){});
    }
};
