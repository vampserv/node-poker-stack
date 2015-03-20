var BOT_CONFIG = require('../../config/bots.json');
var logger = require('pomelo-logger').getLogger('game-log', __filename);
var UserStore = require('../../app/persistence/users');
Hand = require('hoyle').Hand;


var BotService = function(app){
    this.app = app;
    this.channelService = app.get('channelService');
    this.tableService = app.get('tableService');
    this.tableInstance = {};
    this.tableInstanceActive = {};
    this.bots = {};
    this.config = BOT_CONFIG.config;
};

module.exports = BotService;

BotService.prototype.start = function(cb){
    var me = this;
    if(!me.config.enabled){
        return cb();
    }
    me.registerBots(BOT_CONFIG.bots, function(){
        logger.info('all bots registered');
        me.checkAvailability();
        cb();
    });
};

BotService.prototype.registerBots = function(bots, cb){
    var me = this, i = 0;
    if(!bots.length){
        cb();
    }
    function createIfNotExist(){
        bots[i].chips = 100000;
        UserStore.create(bots[i], function(e, user){
            me.bots[user.id] = user;
            me.bots[user.id].available = true;
            if(++i == bots.length){
                return cb();
            }
            createIfNotExist();
        });
    }
    createIfNotExist();
};

BotService.prototype.checkAvailability = function(){
    var me = this;
    setInterval(function(){
        var bot = me.getAvailableBot();
        var table = me.getAvailableTable();
        if(bot && table && (!me.config.minBots || me.config.minBots > me.getActiveBots()) && !me.config.banBots){
            me.joinGame(bot, table);
        }
    }, (1000 * getRandomInt(me.config.joinInterval.min, (me.config.joinInterval.max))));
};

BotService.prototype.getById = function(id){
    return this.bots[id];
};

BotService.prototype.getAvailableBot = function(){
    var bot;
    for(var i in this.bots){
        if(this.bots[i].available){
            bot = this.bots[i];
        }
    }
    return bot;
};

BotService.prototype.getActiveBots = function(){
    var ctr = 0;
    for(var i in this.bots){
        if(!this.bots[i].available){
            ctr += 1;
        }
    }
    return ctr;
};

BotService.prototype.getAvailableTable = function(){
    var table;
    for(var i in this.tableService.tables){
        if(!this.tableInstanceActive[i] && (this.tableService.tables[i].state == 'JOIN' && this.tableService.tables[i].table.playersToAdd.length < this.tableService.tables[i].table.maxPlayers) ||
           (this.tableService.tables[i].state == 'IN_PROGRESS' && (this.tableService.tables[i].table.playersToAdd + this.tableService.tables[i].table.players.length) < this.tableService.tables[i].table.maxPlayers)){
            table = this.tableService.tables[i];
            break;
        }
    }
    return table;
};

BotService.prototype.joinGame = function(bot, table){
    var me = this;
    me.tableService.addPlayer(table.id, bot.id, me.config.buyIn || 1000, function(e){
        if(e){
            return logger.error('bot error joining game', e);
        }
        bot.available = false;
        bot.games = getRandomInt(me.config.gamesToPlay.min, me.config.gamesToPlay.max);
        bot.tid = table.id;
        logger.debug('bot '+bot.username+' joining table '+table.id+' for '+bot.games+' games');
        me.tableInstance[table.id] = me.tableInstance[table.id] || 0;
        me.tableInstance[table.id] += 1;
        me.listen(table.id);
    });
};

BotService.prototype.startGame = function(table, tid){
    var me = this;
    var interval = setInterval(function(){
        if(table.state == 'IN_PROGRESS'){
            clearInterval(interval);
        }
        if(table.table.playersToAdd.length >= (me.config.minPlayers ? me.config.minPlayers : 0) && !me.config.banBots){
            table.tableService.startGame(tid, function(e){
                if(e){
                    return logger.debug('cant start game yet', e);
                }
                clearInterval(interval);
            });
        }
    }, (1000 * getRandomInt(7, 20)));
}

BotService.prototype.leaveGame = function(tid, uid, cb){
    var me = this;
    me.tableService.removeMember(tid, uid, function(){
        cb();
    });
};

BotService.prototype.listen = function(tid){
    var me = this;
    if(me.tableInstance[tid] > 1){
        return false;
    }
    logger.debug('initializing listeners for table '+tid);
    var table = me.tableService.getTable(tid);
    var playerJoinedListener = function(){
        logger.debug('playerJoined');
        me.startGame(table, tid);
    };
    var newRoundListener = function(){
        logger.debug('newRound');
        me.moveIfTurn(table);
    };
    var turnStartListener = function(){
        logger.debug('turnStart');
        me.moveIfTurn(table);
    };
    var gameInitListener = function(){
        logger.debug('gameInit');
        setTimeout(function(){
            me.removeAllBots(tid);
        }, 300);
    };
    table.table.eventEmitter.on('playerJoined', playerJoinedListener);
    table.table.eventEmitter.on('newRound', newRoundListener);
    table.table.eventEmitter.on('turnStart', turnStartListener);
    table.table.eventEmitter.on('gameInit', gameInitListener);
};

BotService.prototype.moveIfTurn = function(table){
    var me = this, pid;
    if(typeof table.table.currentPlayer === 'number' && table.table.players[table.table.currentPlayer])
        pid = table.table.players[table.table.currentPlayer].id;
    if(this.bots[pid]){
        logger.debug('starting move: '+this.bots[pid].username);
        table.table.stopTimer();
        setTimeout(function(){
            if(!table.table || !table.table.game) return false;
            var board = table.table.game.board || [];
            if(board.length < 3){
                table.table.players[table.table.currentPlayer].Call();
            }else{
                performMove(table);
            }
            logger.debug('completed move.');
            table.tableService.handleGameState(table.id, function(e){
                if(e){
                    logger.error(e);
                }
            });
        }, (getRandomInt(me.config.actionInterval.min, me.config.actionInterval.max) * 1000));
    }
};

function performMove(table){
    var currentPlayer = table.table.players[table.table.currentPlayer];
    var myBet = table.table.game.bets[table.table.currentPlayer];
    var myHand = Hand.make(getHand(table.table.game.board.concat(table.table.players[table.table.currentPlayer].cards)));
    var maxBet = myBet;
    var maxRank = myHand.rank;
    var winningPlayer = currentPlayer.playerName;
    var hands = [];
    for(var i=0;i<table.table.players.length;++i){
        var bet = table.table.game.bets[i];
        var hand = Hand.make(getHand(table.table.game.board.concat(table.table.players[i].cards)));
        if(bet > maxBet) maxBet = bet;
        if(hand.rank > maxRank){
            maxRank = hand.rank;
            winningPlayer = table.table.players[i].playerName;
        }
        hands.push(hand);
    }
    logger.debug('has best hand: '+ winningPlayer);
    var isWinner = false;
    var winners = Hand.pickWinners(hands);
    var diff = maxBet - myBet;
    for(var i=0;i<winners.length;++i){
        if(winners[i] === myHand) isWinner = true;
    }
    if(myHand.rank < maxRank){
        if(myBet >= maxBet){
            if(getRandomInt(1, 51) > 47){
                currentPlayer.AllIn();
            }else if(getRandomInt(1, 10) > 7){
                currentPlayer.Bet(getRandomInt(2, 53));
            }else{
                currentPlayer.Call();
            }
        }else if(myBet < maxBet){
            if(diff > getRandomInt(4, 61)){
                if(getRandomInt(1, 73) > 71){
                    currentPlayer.AllIn();
                }else if(getRandomInt(1, 10) > 8){
                    currentPlayer.Bet(getRandomInt(2, 36));
                }else if(getRandomInt(1, 10) > 2){
                    currentPlayer.Fold();
                }else{
                    currentPlayer.Call();
                }
            }else{
                if(getRandomInt(1, 73) > 70){
                    currentPlayer.AllIn();
                }else if(getRandomInt(1, 10) > 7){
                    currentPlayer.Bet(getRandomInt(2, 43));
                }else if(diff > getRandomInt(1, 7) && getRandomInt(1, 10) > 6){
                    currentPlayer.Fold();
                }else{
                    currentPlayer.Call();
                }
            }
        }else{
            currentPlayer.Call();
        }
    }else{
        if(myBet >= maxBet){
            if(getRandomInt(1, 10) == 10){
                currentPlayer.AllIn();
            }else if(getRandomInt(1, 10) > 4){
                currentPlayer.Bet(getRandomInt(1, 271));
            }else{
                currentPlayer.Call();
            }
        }else if(myBet < maxBet){
            if(getRandomInt(1, 10) == 10){
                currentPlayer.AllIn();
            }else if(getRandomInt(1, 10) > 4){
                currentPlayer.Bet(getRandomInt(2, 189));
            }else if(diff > getRandomInt(71, 104) && getRandomInt(1, 10) > 8){
                currentPlayer.Fold();
            }else{
                currentPlayer.Call();
            }
        }else{
            currentPlayer.Call();
        }
    }
}

function getHand(hand){
    for(var j=0;j<hand.length;++j){
        hand[j] = hand[j].split('');
        hand[j] = hand[j][0]+hand[j][1].toLowerCase();
    }
    return hand;
}

function getRandomInt(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

BotService.prototype.removeAllBots = function(tid, banBots){
    var me = this, botAry = [];
    me.config.banBots = banBots;
    var table = me.tableService.getTable(tid);
    for(var id in me.bots){
        if(me.bots[id].tid === tid)
            botAry.push(id);
    }
    if(me.config.validateChips){
        me.tableInstanceActive[tid] = true;
    }
    me.removeBot(botAry, 0, tid, banBots, function(){
        if(me.tableInstance[tid] === 0){
            logger.debug('removing listeners for table '+tid);
            table.table.eventEmitter.removeAllListeners('playerJoined');
            table.table.eventEmitter.removeAllListeners('newRound');
            table.table.eventEmitter.removeAllListeners('turnStart');
            table.table.eventEmitter.removeAllListeners('gameInit');
        }
        if(me.config.validateChips){
            me.validateTotalChips(function(e){
                if(!e){
                    me.tableInstanceActive[tid] = false;
                    me.startGame(table, tid);
                }
            });
        }else{
            me.startGame(table, tid);
        }
    });
};

BotService.prototype.removeBot = function(botAry, i, tid, banBots, cb){
    var me = this;
    if(i === botAry.length){
        return cb();
    }
    var bid = botAry[i];
    if(me.bots[bid].tid === tid){
        me.bots[bid].games -= 1;
        var user = me.tableService.getPlayerJSON(tid, bid, 'players') || me.tableService.getPlayerJSON(tid, bid, 'playersToAdd') || me.tableService.getPlayerJSON(tid, bid, 'previousPlayers');
        console.log(me.tableService.getTable(tid));
        console.log(tid, bid, user);
        if(me.bots[bid].games === 0 || (user && user.chips === 0) || banBots === true){
            logger.debug('bot '+me.bots[bid].username+' ('+me.bots[bid].id+') left game '+tid+' with '+((user && user.chips) ? user.chips : 0)+' chips', user);
            me.leaveGame(tid, bid, function(){
                me.bots[bid].available = true;
                delete me.bots[bid].tid;
                me.tableInstance[tid] -= 1;
                me.removeBot(botAry, (i+1), tid, banBots, cb);
            });
        }else{
            me.removeBot(botAry, (i+1), tid, banBots, cb);
        }
    }
};

// validate chips per all bots
BotService.prototype.validateTotalChips = function(cb){
    var total = 0;
    var ids = [];
    for(var i in this.bots){
        ids.push(this.bots[i].id);
    }
    UserStore.getByIds(ids, function(e, users){
        for(var user in users){
            total += users[user].chips;
        }
        var correctTotal = (ids.length * 100000);
        if(total != correctTotal){
            logger.error('INCORRECT TOTAL CHIPS! '+correctTotal+' - '+total+' = '+(correctTotal - total));
            return cb('incorrect-total');
        }
        logger.debug('correct total chips '+total+'/'+correctTotal);
        cb();
    });
}

// validate chips per table
BotService.prototype.validateChips = function(table, cb){
    var me = this;
    var total = 0;
    var ids = [];
    for(var i=0;i<table.table.playersToAdd.length;++i){
        ids.push(table.table.playersToAdd[i].id);
    }
    UserStore.getByIds(ids, function(e, users){
        for(var user in users){
            total += users[user].chips;
        }
        total += (ids.length * me.config.buyIn);
        var correctTotal = (ids.length * 100000);
        if(total != correctTotal){
            logger.error('INCORRECT GAME CHIPS! '+correctTotal+' - '+total+' = '+(correctTotal - total));
            return cb('incorrect-total');
        }
        cb();
    });
}

