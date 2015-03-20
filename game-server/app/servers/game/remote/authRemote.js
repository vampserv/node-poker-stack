var UserStore = require('../../../persistence/users');
var tokenService = require('../../../../../shared/token');
var SESSION_CONFIG = require('../../../../../shared/config/session.json');

module.exports = function(app){
    return new Remote(app);
};
var Remote = function(app){
    this.app = app;
};
var remote = Remote.prototype;

/**
 * Register user.
 *
 * @param  {object}   userObj object containing userObj.user and userObj.pass
 * @param  {Function} cb
 * @return {Void}
 */
remote.register = function(userObj, cb){
    UserStore.create({
        username  : userObj.username,
        password  : userObj.password,
        email     : userObj.email,
        chips     : 100000
    }, function(e, user){
        if(e){
            cb(e);
        }else{
            cb(null, user);
        }
    });
};
/**
 * Auth via user/pass or token, and check for expiry.
 *
 * @param  {object|string}   input token or object containing username and password
 * @param  {Function} cb
 * @return {Void}
 */
remote.auth = function(input, cb){
    if(typeof input === 'string'){
        var res = tokenService.parse(input, SESSION_CONFIG.secret);
        if(!res){
            cb('invalid-token');
            return;
        }
        if(!checkExpire(res, SESSION_CONFIG.expire)){
            cb('token-expired');
            return;
        }
        UserStore.getByAttr('id', res.uid, false, function(e, user){
            if(e){
                cb('invalid-user');
                return;
            }
            cb(null, user);
        });
    }else{
        UserStore.getByAttr(['username', 'password'], [input.username, input.password], false, function(e, user){
            if(!user){
                cb('invalid-user');
            }else{
                cb(null, user, tokenService.create(user.id, Date.now(), SESSION_CONFIG.secret));
            }
        });
    }
};
/**
 * Check the token whether expire.
 *
 * @param  {Object} token  token info
 * @param  {Number} expire expire time
 * @return {Boolean} true for not expire and false for expire
 */
var checkExpire = function(token, expire){
    if(expire < 0){
        // negative expire means never expire
        return true;
    }
    return (Date.now() - token.timestamp) < expire;
};
