var logger = require('pomelo-logger').getLogger('game-log', __filename);
var Hand = require('./hand');


module.exports = Player = function(playerName, chips, uid, table){
    this.playerName = playerName;
    this.id = uid;
    this.chips = chips;
    this.folded = false;
    this.allIn = false;
    this.talked = false;
    this.table = table; //Circular reference to allow reference back to parent object.
    this.cards = [];
}

Player.prototype.GetChips = function(cash){
    this.chips += cash;
};

Player.prototype.Check = function(){
    var checkAllow, v, i;
    checkAllow = true;
    for(v=0;v<this.table.game.bets.length;v += 1){
        if(this.table.game.bets[v] !== 0){
            checkAllow = false;
        }
    }
    if(checkAllow){
        for(i=0;i< this.table.players.length;i+=1){
            if(this === this.table.players[i]){
                this.table.game.bets[i] = 0;
                this.talked = true;
            }
        }
        // attempt to progress the game
        this.turnBet = {action: "check", playerName: this.playerName};
        this.table.actions.push(this.turnBet);
        progress(this.table);
    }else{
        logger.debug('check-not-allowed by '+this.id);
    }
};

Player.prototype.Fold = function(){
    var i, bet;
    //Move any current bet into the pot
    for(i=0;i< this.table.players.length;i+=1){
        if(this.id === this.table.players[i].id){
            bet = parseInt(this.table.game.bets[i], 10);
            this.table.game.roundBets[i] += bet;
            this.table.game.bets[i] = 0;
            this.table.game.pot += bet;
            this.talked = true;
        }
    }
    //Mark the player as folded
    this.folded = true;
    this.turnBet = {action: "fold", playerName: this.playerName};
    this.table.actions.push(this.turnBet);
    // attempt to progress the game
    progress(this.table);
};

Player.prototype.Bet = function(bet){
    var i = this.getIndex();
    var maxBet = getMaxBet(this.table.game.bets);
    var totalBet = bet + maxBet;
    var currentBet = this.table.game.bets[i];
    if((currentBet + this.chips) > totalBet){
        this.table.players[i].chips -= (totalBet - currentBet);
        this.table.game.bets[i] = totalBet; // this.table.game.bets[i] += totalBet;
        this.talked = true;
        // attempt to progress the game
        this.turnBet = {action: "bet", playerName: this.playerName, amount: totalBet};
        this.table.actions.push(this.turnBet);
        progress(this.table);
    }else{
        logger.debug('forced-all-in: '+this.id);
        this.AllIn();
    }
};

Player.prototype.getIndex = function(){
    var index;
    for(i=0;i< this.table.players.length;i+=1){
        if(this === this.table.players[i]){
            index = i;
        }
    }
    return index;
}

Player.prototype.Call = function(){
    var maxBet, i;
//    console.log('bets', this.table.game.bets);
    maxBet = getMaxBet(this.table.game.bets);
    if(this.chips > maxBet){
//        console.log('higher chips', this.chips, maxBet);
        //Match the highest bet
        for(i=0;i< this.table.players.length;i+=1){
            if(this === this.table.players[i]){
                if(this.table.game.bets[i] >= 0){
                    this.chips += this.table.game.bets[i];
                }
                this.chips -= maxBet;
                this.table.game.bets[i] = maxBet;
                this.talked = true;
            }
        }
        // attempt to progress the game
        this.turnBet = {action: "call", playerName: this.playerName, amount: maxBet};
        this.table.actions.push(this.turnBet);
        progress(this.table);
    }else{
        logger.debug('forced-all-in: '+this.id);
        this.AllIn();
    }
};

Player.prototype.AllIn = function(){
    var i, allInValue=0;
    for(i=0;i< this.table.players.length;i+=1){
        if(this === this.table.players[i]){
            if(this.table.players[i].chips !== 0){
                allInValue = this.table.players[i].chips;
                this.table.game.bets[i] += this.table.players[i].chips;
                this.table.players[i].chips = 0;

                this.allIn = true;
                this.talked = true;
            }
        }
    }

    // attempt to progress the game
    this.turnBet = {action: "allin", playerName: this.playerName, amount: allInValue};
    this.table.actions.push(this.turnBet);

    progress(this.table);
};

function progress(table){
    var i, j, cards, hand;
    if(table.game){
        table.eventEmitter.emit("turnEnd");
        table.stopTimer();
        if(checkForEndOfGame(table)){
            //Move all bets to the pot
            for(i=0;i< table.game.bets.length;i+=1){
                table.game.pot += parseInt(table.game.bets[i], 10);
                table.game.roundBets[i] += parseInt(table.game.bets[i], 10);
            }
            completeGame(table);
            return;
        }
        if(checkForEndOfRound(table) === true){
            //Move all bets to the pot
            for(i=0;i< table.game.bets.length;i+=1){
                table.game.pot += parseInt(table.game.bets[i], 10);
                table.game.roundBets[i] += parseInt(table.game.bets[i], 10);
            }
            if(table.game.roundName === 'River'){
                completeGame(table);
                return;
            }else if(table.game.roundName === 'Turn'){
                table.game.roundName = 'River';
                table.game.deck.pop(); //Burn a card
                table.game.board.push(table.game.deck.pop()); //Turn a card
                //table.game.bets.splice(0,table.game.bets.length-1);
                for(i=0;i< table.game.bets.length;i+=1){
                    table.game.bets[i] = 0;
                }
                for(i=0;i< table.players.length;i+=1){
                    table.players[i].talked = false;
                }
                table.eventEmitter.emit( "deal" );
            }else if(table.game.roundName === 'Flop'){
                table.game.roundName = 'Turn';
                table.game.deck.pop(); //Burn a card
                table.game.board.push(table.game.deck.pop()); //Turn a card
                for(i=0;i< table.game.bets.length;i+=1){
                    table.game.bets[i] = 0;
                }
                for(i=0;i< table.players.length;i+=1){
                    table.players[i].talked = false;
                }
                table.eventEmitter.emit( "deal" );
            }else if(table.game.roundName === 'Deal'){
                table.game.roundName = 'Flop';
                table.game.deck.pop(); //Burn a card
                for(i=0;i< 3;i+=1){ //Turn three cards
                    table.game.board.push(table.game.deck.pop());
                }
                //table.game.bets.splice(0,table.game.bets.length-1);
                for(i=0;i< table.game.bets.length;i+=1){
                    table.game.bets[i] = 0;
                }
                for(i=0;i< table.players.length;i+=1){
                    table.players[i].talked = false;
                }
                table.eventEmitter.emit( "deal" );
            }
            table.currentPlayer = getNextAvailablePlayer(table, table.startIndex, table.players.length);
            if(typeof table.currentPlayer !== 'number' && table.game.roundName !== 'GameEnd'){
                console.log('ALL IN GAME');
                completeBoard(table);
                return progress(table);
            }
        }
        table.eventEmitter.emit("turnStart");
    }
}

function completeGame(table){
    table.game.roundName = 'GameEnd';
    table.game.bets.splice(0, table.game.bets.length);
    //Evaluate each hand
    for(j = 0; j < table.players.length; j += 1){
        cards = table.players[j].cards.concat(table.game.board);
        table.players[j].hand = new Hand(cards);
    }
    console.log('checkForWinner', table);
    checkForWinner(table);
    table.eventEmitter.emit('gameOver');
}

function completeBoard(table){
    var i;
    if(table.game.board.length == 0){
        table.game.deck.pop();
        for(i=0;i<3;i+=1){
            table.game.board.push(table.game.deck.pop());
        }
    }
    if(table.game.board.length == 3){
        table.game.deck.pop();
        table.game.board.push(table.game.deck.pop());
    }
    if(table.game.board.length == 4){
        table.game.deck.pop();
        table.game.board.push(table.game.deck.pop());
    }
}

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

function checkForEndOfGame(table){
    var notFolded = [], allInPlayer = [], actionablePlayer = [], i;
    for(i = 0; i < table.players.length;i+=1){
        if(table.players[i].folded === false){
            notFolded.push(i);
        }
        if(table.players[i].allIn === true){
            allInPlayer.push(i);
        }
        if(table.players[i].folded === false && table.players[i].allIn === false){
            actionablePlayer.push(i);
        }
    }
    if(allInPlayer.length > 1){
        completeBoard(table);
    }
    return (notFolded.length === 1 || actionablePlayer.length === 0);
}

function checkForEndOfRound(table){
    var endOfRound = true;
    var nextPlayer = getNextAvailablePlayer(table, (table.currentPlayer + 1), table.players.length);
    if(typeof nextPlayer === 'number'){
        table.currentPlayer = nextPlayer;
        endOfRound = false;
    }
    return endOfRound;
}

function getNextAvailablePlayer(table, playerIndex, len, ctr){
    ctr = ctr || 0;
    var maxBet = getMaxBet(table.game.bets);
    var nextPlayer;
    if(playerIndex === len){
        playerIndex = 0;
    }
    if(table.players[playerIndex].folded === false && (table.players[playerIndex].talked === false || table.game.bets[playerIndex] !== maxBet) && table.players[playerIndex].allIn === false){
        nextPlayer = playerIndex;
    }
    ctr += 1;
    playerIndex += 1;
    if(typeof nextPlayer !== 'number' && ctr !== len){
        nextPlayer = getNextAvailablePlayer(table, playerIndex, len, ctr);
    }
    return nextPlayer;
}

function checkForAllInPlayer(table, winners){
    var i, allInPlayer;
    allInPlayer = [];
    for(i=0;i< winners.length;i+=1){
        if(table.players[winners[i]].allIn === true){
            allInPlayer.push(winners[i]);
        }
    }
    return allInPlayer;
}

function checkForWinner(table){
    var i, j, k, l, maxRank, notFolded, winners, part, prize, allInPlayer, minBets, roundEnd;
    //Identify winner(s)
    winners = [];
    notFolded = [];
    maxRank = 0.000;
    for(k = 0; k < table.players.length; k += 1){
        if(table.players[k].folded === false){
            notFolded.push(k);
        }
        if(table.players[k].hand.rank === maxRank && table.players[k].folded === false){
            winners.push(k);
        }
        if(table.players[k].hand.rank > maxRank && table.players[k].folded === false){
            maxRank = table.players[k].hand.rank;
            winners.splice(0, winners.length);
            winners.push(k);
        }
    }
    // handle mid-round fold
    if(winners.length === 0 && notFolded.length == 1){
        console.log('mid round fold');
        winners.push(notFolded[0]);
    }
    part = 0;
    prize = 0;
    console.log('roundBets', table.game.roundBets);
    allInPlayer = checkForAllInPlayer(table, winners);
    if(allInPlayer.length > 0){
        minBets = table.game.roundBets[winners[0]];
        for(j = 1; j < allInPlayer.length; j += 1){
            if(table.game.roundBets[winners[j]] !== 0 && table.game.roundBets[winners[j]] < minBets){
                minBets = table.game.roundBets[winners[j]];
            }
        }
        part = parseInt(minBets, 10);
    }else{
        part = parseInt(table.game.roundBets[winners[0]], 10);
    }
    console.log('part', part);
    for(l = 0; l < table.game.roundBets.length; l += 1){
        // handle user leave
//        console.log('more than 1 player', table.players.length > 1 && (table.players.length - table.playersToRemove.length > 1));
        if(table.game.roundBets[l] > part){
            prize += part;
            table.game.roundBets[l] -= part;
        }else{
            prize += table.game.roundBets[l];
            table.game.roundBets[l] = 0;
        }
    }
    console.log('prize', prize);
    console.log('winners', winners);

    if(prize > 0){
        var remainder = prize % winners.length;
        var winnerHands = [];
        var highestIndex;
        var winnerPrize = Math.floor(prize / winners.length);
        if(remainder !== 0){
            console.log('chip remainder of '+remainder);
            for(i=0;i<winners.length;++i){
                winnerHands.push(table.players[winners[i]].cards);
            }
            highestIndex = getOddChipWinner(winnerHands);
        }

        for(i=0;i<winners.length;++i){
            var winningPlayer = table.players[winners[i]];
            if(i === highestIndex){
                winnerPrize += remainder;
                console.log('player '+winningPlayer.playerName+' gets the remaining '+remainder+' chips');
            }
            winningPlayer.chips += winnerPrize;
            if(table.game.roundBets[winners[i]] === 0){
                winningPlayer.folded = true;
                table.gameWinners.push({
                    playerName: winningPlayer.playerName,
                    id: winningPlayer.id,
                    amount: winnerPrize,
                    hand: winningPlayer.hand,
                    chips: winningPlayer.chips
                });
            }
            logger.debug('player '+table.players[winners[i]].playerName+'('+table.players[winners[i]].id+') wins '+winnerPrize+' chips');
            if(i === highestIndex)
                winnerPrize -= remainder;
        }
    }
    roundEnd = true;
    console.log('roundBets', table.game.roundBets);
    for(l = 0; l < table.game.roundBets.length;l+=1){
        if(table.game.roundBets[l] !== 0){
            roundEnd = false;
        }
    }
    if(roundEnd === false){
        checkForWinner(table);
    }
}

function checkForBankrupt(table){
    var i;
    for(i=0;i<table.players.length;i+= 1){
        if(table.players[i].chips === 0){
            table.gameLosers.push(table.players[i]);
            logger.debug('player '+table.players[i].playerName+'('+table.players[i].id+') went bankrupt');
//            table.players.splice(i, 1);
        }
    }
}

function getOddChipWinner(hands){
    var i, highestIndex, highestAmt = 0;
    console.log('getOddChipWinner', hands);
    for(i=0;i<hands.length;++i){
        var hand = hands[i];
        var rank1 = getCardRank(hand[0]);
        var rank2 = getCardRank(hand[1]);
        if(highestAmt < rank1){
            highestAmt = rank1;
            highestIndex = i;
        }
        if(highestAmt < rank2){
            highestAmt = rank2;
            highestIndex = i;
        }
    }
    console.log('odd chip owner result: '+highestIndex+' '+highestAmt);
    return highestIndex;
}

function getCardRank(card){
    var rank = 0;
    switch(card[0]){
        case 'A': rank += 130; break;
        case 'K': rank += 120; break;
        case 'Q': rank += 110; break;
        case 'J': rank += 100; break;
        case 'T': rank += 90; break;
        case '9': rank += 80; break;
        case '8': rank += 70; break;
        case '7': rank += 60; break;
        case '6': rank += 50; break;
        case '5': rank += 40; break;
        case '4': rank += 30; break;
        case '3': rank += 20; break;
        case '2': rank += 10; break;
    }
    switch(card[1]){
        case 'S': rank += 4; break;
        case 'H': rank += 3; break;
        case 'D': rank += 2; break;
        case 'C': rank += 1; break;
    }
    return rank;
}