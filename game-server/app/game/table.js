var logger = require('pomelo-logger').getLogger('game-log', __filename);
var events = require('events');
var Game = require('./game');
var Player = require('./player');
var GAME_SETTINGS = require('../../config/gameSettings.json');

/**
 * Table object handles table logic while it is stored in memory.
 *
 * @param {number} smallBlind small blind
 * @param {number} bigBlind big blind
 * @param {number} minPlayers minimum number of players before game can be started
 * @param {number} maxPlayers maximum number of players before game can be started
 * @param {number} minBuyIn minimum buy in
 * @param {number} maxBuyIn maximum buy in
 * @param {string} gameMode type of game
 * @param {object} table instance of a table
 *
 */
module.exports = Table = function(smallBlind, bigBlind, minPlayers, maxPlayers, minBuyIn, maxBuyIn, gameMode, table){
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.minPlayers = minPlayers;
    this.maxPlayers =  maxPlayers;
    this.players = [];
    this.dealer = 0; //Track the dealer position between games
    this.minBuyIn = minBuyIn;
    this.maxBuyIn = maxBuyIn;
    this.previousPlayers = [];
    this.playersToRemove = [];
    this.playersToAdd = [];
    this.eventEmitter = new events.EventEmitter();
    this.turnBet = {};
    this.gameWinners = [];
    this.gameLosers = [];
    this.actions = [];
    this.members = [];
    this.active = false;
    this.gameMode = gameMode;
    this.instance = table;
    //Validate acceptable value ranges.
    var err;
    if(minPlayers < 2){ //require at least two players to start a game.
        err = new Error(101, 'Parameter [minPlayers] must be a postive integer of a minimum value of 2.');
    }else if(maxPlayers > 10){ //hard limit of 10 players at a table.
        err = new Error(102, 'Parameter [maxPlayers] must be a positive integer less than or equal to 10.');
    }else if(minPlayers > maxPlayers){ //Without this we can never start a game!
        err = new Error(103, 'Parameter [minPlayers] must be less than or equal to [maxPlayers].');
    }
    if(err){
        return err;
    }
}

Table.prototype.initNewGame = function(){
    var i;
    this.instance.state = 'JOIN';
    this.dealer += 1;
    if(this.dealer >= this.players.length){
        this.dealer = 0;
    }
    delete this.game;
    this.previousPlayers = [];
    // add existing players and remove players who left or are bankrupt
    for(i=0;i<this.players.length;++i){
        this.previousPlayers.push(this.players[i]);
        if(this.playersToRemove.indexOf(i) === -1){
            this.AddPlayer(this.players[i].playerName, this.players[i].chips, this.players[i].id);
        }
    }
    this.players = [];
    this.playersToRemove = [];
    this.actions = [];
    this.eventEmitter.emit('gameInit');
};

Table.prototype.StartGame = function(){
    //If there is no current game and we have enough players, start a new game.
    this.instance.state = 'IN_PROGRESS';
    this.active = true;
    if(!this.game){
        this.game = new Game(this.smallBlind, this.bigBlind);
        this.NewRound();
    }
};

Table.prototype.AddPlayer = function(playerName, chips, uid){
    if(chips >= this.minBuyIn && chips <= this.maxBuyIn){
        var player = new Player(playerName, chips, uid, this);
        this.playersToAdd.push(player);
    }
};
Table.prototype.removePlayer = function(pid){
    for(var i in this.players ){
        if(this.players[i].id === pid){
            this.playersToRemove.push( parseInt(i) );
            this.players[i].Fold();
        }
    }
    for(var i in this.playersToAdd ){
        if(this.playersToAdd[i].id === pid){
            this.playersToAdd.splice(i, 1);
        }
    }
    for(var i in this.members ){
        if(this.members[i].id === pid){
            this.members.splice(i, 1);
        }
    }
    for(var i in this.previousPlayers){
        if(this.previousPlayers[i].id === pid){
            this.previousPlayers.splice(i, 1);
        }
    }
    this.eventEmitter.emit("playerLeft");
}
Table.prototype.NewRound = function(){
    var removeIndex = 0;
    for(var i in this.playersToAdd){
//        if(removeIndex < this.playersToRemove.length){
//            var index = this.playersToRemove[removeIndex];
//            this.players[index] = this.playersToAdd[i];
//            removeIndex += 1;
//        }else{
//            this.players.push(this.playersToAdd[i]);
//        }
        this.players.push(this.playersToAdd[i]);
    }
    this.playersToRemove = [];
    this.playersToAdd = [];
    this.gameWinners = [];
    this.gameLosers = [];


    var i, smallBlind, bigBlind;
    //Deal 2 cards to each player
    for(i=0;i< this.players.length;i+=1){
        this.players[i].cards.push(this.game.deck.pop());
        this.players[i].cards.push(this.game.deck.pop());
        this.game.bets[i] = 0;
        this.game.roundBets[i] = 0;
    }
    //Identify Small and Big Blind player indexes
    smallBlind = this.dealer + 1;
    if(smallBlind >= this.players.length){
        smallBlind = 0;
    }
    bigBlind = smallBlind + 1;
    if(bigBlind >= this.players.length){
        bigBlind = 0;
    }
    this.currentPlayer = bigBlind + 1;
    if(this.currentPlayer >= this.players.length){
        this.currentPlayer = 0;
    }
    this.startIndex = this.currentPlayer;
    //Force Blind Bets
    this.players[smallBlind].chips -= this.smallBlind;
    this.players[bigBlind].chips -= this.bigBlind;
    this.game.bets[smallBlind] = this.smallBlind;
    this.game.bets[bigBlind] = this.bigBlind;
    this.game.blinds = [smallBlind, bigBlind];

    this.eventEmitter.emit("newRound");
};

Table.prototype.startTimer = function(){
    var me = this;
    me.stopTimer();
    me._countdown = setTimeout(function(){
        if(!me.active){
            return;
        }
        console.log('timer ended. executing move.');
        if(me.game.bets[me.currentPlayer] < getMaxBet(me.game.bets)){
            me.players[me.currentPlayer].Fold();
        }else{
            me.players[me.currentPlayer].Call();
        }
        me.instance.tableService.handleGameState(me.instance.id, function(e){
            if(e){
                console.error(e);
            }
        });
    }, (GAME_SETTINGS.gameMode[this.gameMode].timeout * 1000));
};

Table.prototype.stopTimer = function(){
    if(this._countdown){
        clearTimeout(this._countdown);
    }
};

function getMaxBet(bets){
    var maxBet, i;
    maxBet = 0;
    for(i=0;i< bets.length;i+=1){
        if(bets[i] > maxBet){
            maxBet = bets[i];
        }
    }
    return maxBet;
}
