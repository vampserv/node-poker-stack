var logger = require('pomelo-logger').getLogger('game-log', __filename);
var REDIS_CONFIG = require('../../config/redis.json');
var redis = require('redis');

/**
 * Maintain a persistent store .
 *
 * StateService is created by stateComponent.
 *
 * @class
 * @constructor
 */
module.exports = StateService = function(){
    this.prefix = 'POKER:';
};

StateService.prototype.start = function(cb){
    this.redis.createClient(REDIS_CONFIG.port, REDIS_CONFIG.host, REDIS_CONFIG.opts);
    this.redis.on('error', function(e){
        logger.error('redis error', e.stack);
        cb('connection-error');
    });
    this.redis.once('ready', function(){
        logger.info('redis initialized!');
        cb();
    });
};

StateService.prototype.stop = function(cb){
    if(this.redis){
        logger.info('redis stopped');
        this.redis.end();
        this.redis = null;
    }
    cb();
};

StateService.prototype.push = function(uid, sid ,cb){
    this.redis.sadd(genKey(this, uid), sid, function(err){
        invokeCallback(cb, err);
    });
};

StateService.prototype.remove = function(uid, sid, cb){
    this.redis.srem(genKey(this, uid), sid, function(err){
        invokeCallback(cb, err);
    });
};

StateService.prototype.getSidsByUid = function(uid, cb){
    this.redis.smembers(genKey(this, uid), function(err, list){
        invokeCallback(cb, err, list);
    });
};

var genKey = function(me, uid){
    return me.prefix + ':' + uid;
};

var invokeCallback = function(cb){
    if(!!cb && typeof cb === 'function'){
        cb.apply(null, Array.prototype.slice.call(arguments, 1));
    }
};