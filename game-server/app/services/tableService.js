var events = require('events');
var uuid = require('node-uuid');
var logger = require('pomelo-logger').getLogger('game-log', __filename);
var TableStore = require('../../app/persistence/tables');
var UserStore = require('../../app/persistence/users');
var dispatcher = require('../util/dispatcher');
var Table = require('../game/table');

/**
 * Create and maintain table tables.
 *
 * TableService is created by tableComponent.
 *
 * @class
 * @constructor
 */
var TableService = function(app, opts){
    opts = opts || {};
    this.app = app;
    this.tables = {};
    this.prefix = opts.prefix;
    this.store = opts.store;
    this.stateService = this.app.get('stateService');
};

module.exports = TableService;

TableService.prototype.start = function(cb){
    cb();
};

TableService.prototype.stop = function(force, cb){
    cb();
};

TableService.prototype.getTable = function(tid){
    return this.tables[tid];
};

TableService.prototype.getTables = function(){
    var tables = {
        tables       : [],
        totalMembers : 0,
        totalPlayers : 0
    };
    for(var i in this.tables){
        var table = this.tables[i];
        var members = table.table.members.length;
        var players = (table.table.players.length - table.table.playersToRemove.length);
        tables.totalMembers += members;
        tables.totalPlayers += players;
        tables.tables.push({
            id         : table.id,
            smallBlind : table.table.smallBlind,
            bigBlind   : table.table.bigBlind,
            minBuyIn   : table.table.minBuyIn,
            maxBuyIn   : table.table.maxBuyIn,
            minPlayers : table.table.minPlayers,
            maxPlayers : table.table.maxPlayers,
            gameMode   : table.table.gameMode,
            players    : players,
            members    : members
        });
    }
    return tables;
};

TableService.prototype.createTable = function(uid, obj, cb){
    if(!obj || (obj && (
            isNaN(obj.smallBlind) ||
            isNaN(obj.bigBlind)   ||
            isNaN(obj.minBuyIn)   ||
            isNaN(obj.maxBuyIn)   ||
            isNaN(obj.minPlayers) ||
            isNaN(obj.maxPlayers) ||
            obj.minPlayers < 2    ||
            obj.minPlayers > 10   ||
            obj.maxPlayers < 2    ||
            obj.maxPlayers > 10
        ))){
        return cb('invalid-table-rules');
    }
    var tid = uuid.v1();
    this.tables[tid] = {};
    this.tables[tid].id = tid;
    this.tables[tid].creator = uid;
    this.tables[tid].state = 'JOIN';
    this.tables[tid].tableService = this;
    obj.smallBlind = Math.round(parseInt(obj.smallBlind));
    obj.bigBlind = Math.round(parseInt(obj.bigBlind));
    obj.minBuyIn = Math.round(parseInt(obj.minBuyIn));
    obj.maxBuyIn = Math.round(parseInt(obj.maxBuyIn));
    obj.minPlayers = Math.round(parseInt(obj.minPlayers));
    obj.maxPlayers = Math.round(parseInt(obj.maxPlayers));
    obj.gameMode = (obj.gameMode == 'normal' || obj.gameMode == 'fast') ? obj.gameMode : 'normal';
    this.tables[tid].table = new Table(obj.smallBlind, obj.bigBlind, obj.minPlayers, obj.maxPlayers, obj.minBuyIn, obj.maxBuyIn, obj.gameMode, this.tables[tid]);
    // automatically join created table
//        session.set('tid', table.id);
//        var tid = session.get('tid');
//        me.app.rpc.chat.chatRemote.add(session, session.uid, tid, function(e, users){
//            if(e){
//                next(500, {
//                    code  : 200,
//                    error : e
//                });
//                return;
//            }
//            var channelService = me.app.get('channelService');
//            var channel = channelService.getChannel(tid, true);
//            channel.pushMessage({
//                route  : 'onTableEvent',
//                msg    : tableService.getTableJSON(tid, session.uid)
//            });
//            channel.pushMessage({
//                route : 'onUpdateUsers',
//                users : users
//            });
//            tableService.broadcastGameState(tid);
//            next(null, {
//                code  : 200,
//                route : msg.route
//            });
//        });
    cb(null, this.tables[tid]);
};

/**
 * Add member to the table
 *
 * @param {Object} tid id of an existing table
 * @param {function} cb callback
 *
 */
TableService.prototype.addMember = function(tid, uid, cb){
    var me = this;
    var channelService = me.app.get('channelService');
    var table = this.tables[tid];
    if(!table){
        cb('table-not-found');
        return;
    }
    UserStore.getByAttr('id', uid, false, function(e, user){
        if(!user){
            cb(e);
        }
        var sid = getSidByUid(uid, me.app);
        if(!sid){
            return cb('invalid-connector-server');
        }
        // TODO: reduce payload by handling based on game state
        var channel = channelService.getChannel(tid, true);
        channel.add(uid, sid);
        channelService.pushMessageByUids({
            route  : 'onTableEvent',
            msg    : me.getTableJSON(tid, uid)
        }, [{
            uid : uid,
            sid : channel.getMember(uid)['sid']
        }], function(){
            logger.debug('initiated player '+uid+' into table '+tid+' with state '+table.state);
            table.table.members.push(user);
            channel.pushMessage({
                route   : 'onUpdateUsers',
                members : table.table.members
            });
            cb();
        });
    });
};

/**
 * Get the connector server id associated with the uid
 */
var getSidByUid = function(uid, app){
    var connector = dispatcher.dispatch(uid, app.getServersByType('connector'));
    if(connector){
        return connector.id;
    }
    return null;
};

/**
 * Remove member from the table
 *
 * @param {Object} tid id of an existing table
 * @param {string} uid userId to remove from the table
 * @param {function} cb callback
 *
 */
TableService.prototype.removeMember = function(tid, uid, cb){
    var me = this;
    if(!me.tables[tid]){
        var e = 'table-not-found';
        logger.error('error removing player '+uid+' from table '+tid, e);
        cb(e);
        return;
    }
    var channelService = me.app.get('channelService');
    var channel = channelService.getChannel(tid, false);
    if(channel && channel.getMember(uid)){
        channel.leave(uid, channel.getMember(uid)['sid']);
    }
    var user = me.getPlayerJSON(tid, uid, 'players') || me.getPlayerJSON(tid, uid, 'playersToAdd') || me.getPlayerJSON(tid, uid, 'previousPlayers');
    if(user){
        console.log('adding '+user.chips+' to player '+user.id);
        me.updatePlayerInfo(uid, {
            chips : user.chips
        }, function(e, updatedUser){
            if(e){
                logger.error('error removing player '+uid+' from table ', e);
            }else{
                logger.debug('removed player '+uid+' from table '+tid);
            }
            me.tables[tid].table.removePlayer(uid);
            me.pushPlayerInfo(tid, uid, updatedUser);
            me.handleGameState(tid, cb);
        });
    }else{
        me.tables[tid].table.removePlayer(uid);
        cb();
    }
};

/**
 * Update player information
 *
 * @param {string} uid id of a user to update
 * @param {object} obj updated player information
 * @param {function} cb callback
 *
 */
TableService.prototype.updatePlayerInfo = function(uid, obj, cb){
    UserStore.getByAttr('id', uid, false, function(e, user){
        if(e){
            return cb(e);
        }
        if(!user){
            return cb('user-not-found');
        }
        var userObj = {
            id : user.id
        };
        if(obj.chips && typeof obj.chips === 'number' && obj.chips != 0){
            userObj.chips = Math.round(user.chips + Math.round(obj.chips))
        }
        if(obj.wins){
            userObj.wins = Math.round(user.wins + Math.round(obj.wins))
        }
        if(obj.wonAmount && obj.wonAmount > user.largestWin){
            userObj.largestWin = obj.wonAmount;
        }
        UserStore.set(userObj, function(e, updatedUser){
            if(e){
                cb(e);
                return;
            }
            cb(null, updatedUser);
        });
    });
};

TableService.prototype.getTableJSON = function(tid, uid){
    if(!this.tables[tid]){
        return;
    }
    var table = this.tables[tid];
    return {
        state           : table.state,
        id              : (table.table && table.table.game && table.table.game.id ? table.table.game.id : undefined),
        tid             : tid,
        creator         : table.creator,
        smallBlind      : table.table.smallBlind,
        bigBlind        : table.table.bigBlind,
        minPlayers      : table.table.minPlayers,
        maxPlayers      : table.table.maxPlayers,
        minBuyIn        : table.table.minBuyIn,
        maxBuyIn        : table.table.maxBuyIn,
        gameMode        : table.table.gameMode,
        players         : this.getPlayersJSON(tid, 'players', uid),
        playersToRemove : this.getPlayersJSON(tid, 'playersToRemove', uid),
        playersToAdd    : this.getPlayersJSON(tid, 'playersToAdd', uid),
        gameWinners     : this.getPlayersJSON(tid, 'gameWinners', uid),
        actions         : table.table.actions,
        game            : stripDeck(table.table.game, ['deck', 'id']),
        board           : (table.table.game && table.table.game.board) ? table.table.game.board : [],
        currentPlayer   : table.table.currentPlayer
    };
};

function stripDeck(obj, props){
    var out = {};
    for(var key in obj){
        if(props.indexOf(key) == -1){
            out[key] = obj[key];
        }
    }
    return out;
}

TableService.prototype.getPlayerIndex = function(tid, uid, type){
    var match;
    if(!this.tables[tid]){
        return;
    }
    for(var i=0;i<this.tables[tid].table[type ? type : 'players'].length;++i){
        if(uid == this.tables[tid].table[type ? type : 'players'][i].id){
            match = i;
        }
    }
    return match;
};

TableService.prototype.getPlayerJSON = function(tid, uid, type, requestUid){
    if(!this.tables[tid]){
        return;
    }
    var playerIndex = this.getPlayerIndex(tid, uid, type);
    var player = this.tables[tid].table[type ? type : 'players'][playerIndex];
    return player ? {
        playerName : player.playerName,
        id         : player.id,
        chips      : player.chips,
        folded     : player.folded,
        allIn      : player.allIn,
        talked     : player.talked,
        amount     : player.amount,
        cards      : (typeof requestUid === 'undefined' || player.id == requestUid) ? player.cards : undefined,
    } : undefined;
};

TableService.prototype.getPlayersJSON = function(tid, type, requestUid){
    var players = [];
    if(!this.tables[tid]){
        return;
    }
    for(var i=0;i<this.tables[tid].table[type ? type : 'players'].length;++i){
        players.push(this.getPlayerJSON(tid, this.tables[tid].table[type ? type : 'players'][i].id, type, requestUid));
    }
    return players;
};

/**
 * Add a player to the game
 *
 * @param {Object} tid id of an existing table
 * @param {string} uid userId to add to the table
 * @param {number} buyIn amount to buy in
 * @param {function} cb callback
 *
 */
TableService.prototype.addPlayer = function(tid, uid, buyIn, cb){
    var me = this;
    if(!this.tables[tid]){
        return cb('table-not-found');
    }
    var table = this.tables[tid].table;
    if(me.getPlayerIndex(tid, uid, 'playersToAdd')){
        return cb('already-joined');
    }
    buyIn = parseInt(buyIn);
    if(isNaN(buyIn) || buyIn < table.minBuyIn || buyIn > table.maxBuyIn){
        cb('invalid-buyin');
        return;
    }
    buyIn = Math.round(buyIn);
    UserStore.getByAttr('id', uid, false, function(e, user){
        if(e){
            cb(e);
            return;
        }
        if(Math.round(user.chips) < table.minBuyIn){
            cb('below-minimum-buyin');
            return;
        }
        if(Math.round(user.chips) < buyIn){
            cb('not-enough-chips');
            return;
        }
        var chips = Math.round(user.chips - buyIn);
        UserStore.set({
            id    : user.id,
            chips : chips
        }, function(e, updatedUser){
            if(e){
                cb(e);
                return;
            }
            table.eventEmitter.emit('playerJoined');
            var mIndex = me.getPlayerIndex(tid, updatedUser.id, 'members');
            if(typeof mIndex === 'number'){
                table.members[mIndex].chips = chips;
            }
            table.AddPlayer(updatedUser.username, buyIn, uid);
            me.pushPlayerInfo(tid, user.id, updatedUser);
            me.app.get('channelService').getChannel(tid, true).pushMessage({
                route   : 'onUpdateUsers',
                members : table.members
            });
            me.app.get('channelService').getChannel(tid, true).pushMessage({
                route  : 'onTableJoin',
                msg    :  me.getPlayerJSON(tid, uid, 'playersToAdd') || me.getPlayerJSON(tid, uid)
            });
            cb();
        });
    });
};

/**
 * Push detailed user information to a user
 *
 * @param {Object} tid id of an existing table
 * @param {string} uid userId to add to the table
 * @param {object} info player information
 * @param {function} cb callback
 *
 */
TableService.prototype.pushPlayerInfo = function(tid, uid, info){
    var channelService = this.app.get('channelService');
    var channel = channelService.getChannel(tid, false);
    if(!channel || !channel.getMember(uid)) return;
    channelService.pushMessageByUids({
        route  : 'onUpdateMyself',
        user   : info
    }, [{
        uid : uid,
        sid : channel.getMember(uid)['sid']
    }], function(e){
        if(e){
            logger.error('unable to push player info ', e);
        }
    });
};

/**
 * Start the game
 *
 * @param {Object} tid id of an existing table
 * @param {function} cb callback
 *
 */
TableService.prototype.startGame = function(tid, cb){
    var table = this.tables[tid];
    if(!table){
        return cb('table-not-found');
    }
    if(table.state != 'JOIN'){
        return cb('table-not-ready');
    }
    if(table.table.active){
        return cb('table-still-active');
    }
    if(table.table.playersToAdd.length < table.table.minPlayers){
        return cb('not-enough-players');
    }
    if(table.table.playersToAdd.length > table.table.maxPlayers){
        return cb('too-many-players');
    }
    // remove chips from user for buy in
    table.table.StartGame();
    this.app.get('channelService').getChannel(tid, true).pushMessage({
        route   : 'onUpdateUsers',
        members : table.table.members
    });
    this.broadcastGameState(tid);
    cb();
};

/**
 * Perform a game action
 *
 * @param {string} tid table id
 * @param {string} uid userId to add to the table
 * @param {object} action an object containing the action type and optionally the amount of chips
 * @param {function} cb callback
 *
 */
TableService.prototype.performAction = function(tid, uid, action, cb){
    var me = this;
    var table = this.tables[tid];
    if(!table){
        return cb('table-not-found');
    }
    if(table.state != 'IN_PROGRESS'){
        return cb('game-not-ready');
    }
    if(me.getPlayerIndex(tid, uid) != table.table.currentPlayer){
        return cb('not-your-turn');
    }
    if(me.getPlayerJSON(tid, uid).folded == true){
        return cb('already-folded');
    }
    if(action.action == 'bet' && isNaN(action.amt)){
        return cb('invalid-bet-amt');
    }
    // perform action
    if(action.action == 'call'){
        table.table.players[table.table.currentPlayer].Call();
    }else if(action.action == 'bet'){
        table.table.players[table.table.currentPlayer].Bet(parseInt(action.amt));
    }else if(action.action == 'check'){
        table.table.players[table.table.currentPlayer].Check();
    }else if(action.action == 'allin'){
        table.table.players[table.table.currentPlayer].AllIn();
    }else if(action.action == 'fold'){
        table.table.players[table.table.currentPlayer].Fold();
    }else{
        return cb('invalid-action');
    }
    table.table.stopTimer();
    logger.debug('player '+uid+' executed action '+action.action+' on table '+tid+' with state '+table.state);
    me.handleGameState(tid, function(e){
        if(e){
            return cb(e);
        }
        cb();
    });
}

/**
 * End game and broadcast result to clients
 *
 * @param {string} tid table id
 * @param {function} cb callback
 *
 */
TableService.prototype.endGame = function(tid, cb){
    var me = this;
    if(!me.tables[tid]){
        cb('table-not-found');
        return;
    }
    var table = me.tables[tid];
    if(table.table.game.roundName != 'GameEnd'){
        cb('not-game-end');
        return;
    }
    table.table.active = false;
    table.table.stopTimer();
    me.saveResults(tid, function(e){
        if(e){
            cb(e);
            return;
        }
        var channelService = me.app.get('channelService');
        channelService.getChannel(tid, false).pushMessage({
            route   : 'onUpdateUsers',
            members : table.table.members
        });
        table.table.initNewGame();
        me.broadcastGameState(tid);
        cb();
    });
};

/**
 * Store table results to persistence
 *
 * @param {string} tid id of the table
 * @param {string} cb callback
 *
 */
TableService.prototype.saveResults = function(tid, cb){
    var me = this;
    if(!this.tables[tid]){
        cb('table-not-found');
    }
    var table = this.tables[tid];
    TableStore.getByAttr('id', table.table.game.id, function(e, foundTable){
        if(foundTable){
            cb('game-already-exists');
            return;
        }
        TableStore.create(me.getTableJSON(tid), function(e, newTable){
            if(e){
                cb(e);
                return;
            }
            var i = 0;
            function saveWinner(){
                me.updatePlayerInfo(table.table.gameWinners[i].id, {
                    wins      : 1,
                    wonAmount : table.table.gameWinners[i].amount
                }, function(){
                    if(++i === table.table.gameWinners.length){
                        cb();
                    }else{
                        saveWinner();
                    }
                });
            }
            if(table.table.gameWinners.length){
                saveWinner();
            }else{
                return cb();
            }
        });
    });
};

/**
 * Handle end of game or broadcast game state to users
 *
 * @param {string} tid id of the table
 * @param {function} cb callback
 *
 */
TableService.prototype.handleGameState = function(tid, cb){
    var me = this;
    var table = me.tables[tid];
    if(table.table && table.table.game && table.table.game.roundName == 'GameEnd' && table.state == 'IN_PROGRESS' && table.table.active){
        me.endGame(tid, cb);
    }else{
        me.app.get('channelService').getChannel(tid, true).pushMessage({
            route   : 'onUpdateUsers',
            members : table.table.members
        });
        me.broadcastGameState(tid);
        cb();
    }
};

/**
 * Broadcast game state by iteratively pushing game details to clients
 *
 * @param {string} tid id
 *
 */
TableService.prototype.broadcastGameState = function(tid){
    var i = 0;
    var me = this;
    var channelService = me.app.get('channelService');
    var channel = channelService.getChannel(tid, false);
    function broadcast(){
        if(i == me.tables[tid].table.members.length){
            if(me.tables[tid].state == 'IN_PROGRESS' && me.tables[tid].table.active){
                me.tables[tid].table.startTimer();
            }
            return;
        }
        var uid = me.tables[tid].table.members[i].id;
        if(channel.getMember(uid)){
            channelService.pushMessageByUids({
                route  : 'onTableEvent',
                msg    : me.getTableJSON(tid, uid)
            }, [{
                uid : uid,
                sid : channel.getMember(uid)['sid']
            }], function(){
                ++i;
                broadcast();
            });
        }else{
            ++i;
            broadcast();
        }
    }
    broadcast();
}

/**
 * Shuffles an array
 *
 * @param {array} ary an array
 *
 */
TableService.prototype.shuffle = function(ary){
    var currentIndex = ary.length, temporaryValue, randomIndex;
    while(0 !== currentIndex){
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = ary[currentIndex];
        ary[currentIndex] = ary[randomIndex];
        ary[randomIndex] = temporaryValue;
    }
    return ary;
};

