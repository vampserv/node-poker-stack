var logger = require('pomelo-logger').getLogger('game-log', __filename);
var UserStore = require('../../../persistence/users');

module.exports = function(app){
    return new Handler(app);
};
var Handler = function(app){
    this.app = app;
};
var handler = Handler.prototype;

/**
 * Get users matching the criteria
 *
 * @param {Object} msg game parameters from client
 * @param {Object} session
 * @param  {Function} next next step callback
 *
 */
handler.getUsers = function(msg, session, next){
    if(!msg.name && !msg.val && !session.uid){
        return next(null, {
            code  : 500,
            error : 'invalid-input'
        });
    }
    var searchId = (msg.name == 'id' || msg.name == 'username' || msg.name == 'email') ? msg.name : 'id';
    var searchVal = typeof msg.val === 'string' ? msg.val : session.uid;
    UserStore.getByAttr(searchId, searchVal, {
        getArray : true
    }, function(e, matches){
        if(e){
            return next(null, {
                code  : 500,
                error : e
            });
        }
        next(null, {
            code    : 200,
            route   : msg.route,
            matches : matches
        });
    });
};

/**
 * Update user profile
 *
 * @param {Object} msg game parameters from client
 * @param {Object} session
 * @param  {Function} next next step callback
 *
 */
handler.setProfile = function(msg, session, next){
    if(!session.uid){
        return next(null, {
            code  : 500,
            error : 'invalid-session'
        });
    }
    UserStore.getByAttr('id', session.uid, false, function(e, user){
        if(e){
            return next(null, {
                code  : 500,
                error : e
            });
        }
        var userObj = {
            id : user.id
        };
        if(msg.email){
            userObj.email = msg.email.trim();
        }
        UserStore.set(userObj, function(e, updatedUser){
            if(e){
                return next(null, {
                    code  : 500,
                    error : e
                });
            }
            next(null, {
                code   : 200,
                route  : msg.route
            });
        });
    });
};

/**
 * Update user password
 *
 * @param {Object} msg game parameters from client
 * @param {Object} session
 * @param  {Function} next next step callback
 *
 */
handler.setPassword = function(msg, session, next){
    if(!session.uid || !msg.oldpassword || !msg.password){
        return next(null, {
            code  : 500,
            error : 'invalid-input'
        });
    }
    UserStore.getByAttr(['id', 'password'], [session.uid, msg.oldpassword], false, function(e, user){
        if(e){
            return next(null, {
                code  : 500,
                error : e
            });
        }
        var userObj = {
            id       : user.id,
            password : msg.password.trim()
        };
        UserStore.set(userObj, function(e, updatedUser){
            if(e){
                return next(null, {
                    code  : 500,
                    error : e
                });
            }
            next(null, {
                code   : 200,
                route  : msg.route
            });
        });
    });
};

/**
 * Add a friend to friend list
 *
 * @param {Object} msg game parameters from client
 * @param {Object} session
 * @param  {Function} next next step callback
 *
 */
handler.addFriend = function(msg, session, next){
    if(!session.uid){
        return next(null, {
            code  : 500,
            error : 'invalid-session'
        });
    }
    if(!msg.friend){
        return next(null, {
            code   : 200,
            route  : msg.route
        });
    }
    UserStore.getByAttr('id', session.uid, {
        getFullEntity : true
    }, function(e, user){
        if(e){
            return next(null, {
                code  : 500,
                error : e
            });
        }
        UserStore.getByAttr('id', msg.friend, false, function(e, friend){
            if(e){
                return next(null, {
                    code  : 500,
                    error : e
                });
            }
            user.friends.push({
                id       : friend.id,
                username : friend.username
            });
            UserStore.set({
                id      : user.id,
                friends : user.friends
            }, function(e, updatedUser){
                if(e){
                    return next(null, {
                        code  : 500,
                        error : e
                    });
                }
                next(null, {
                    code   : 200,
                    route  : msg.route
                });
            });
        });
    });
};