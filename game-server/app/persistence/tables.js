var uuid = require('node-uuid');
var util = require('util');
var fs = require('fs');

var TableStore = module.exports = {
    store  : './localstore/tables.json',
    entity : 'tables',
    create : function(obj, cb){
        var me = this;
        me.persist({
            id          : obj.id || uuid.v1(),
            tid         : obj.tid,
            smallBlind  : obj.smallBlind,
            bigBlind    : obj.bigBlind,
            minBuyIn    : obj.minBuyIn,
            maxBuyIn    : obj.maxBuyIn,
            minPlayers  : obj.minPlayers,
            maxPlayers  : obj.maxPlayers,
            gameMode    : obj.gameMode,
            board       : obj.board,
            creator     : obj.creator,
            players     : obj.players || [],
            actions     : obj.actions || [],
            gameWinners : obj.gameWinners || [],
            created     : Date.now()
        }, function(e, table){
            if(e){
                cb(e);
            }else{
//                console.log('TableStore: table created - ', table);
                cb(null, table);
            }
        });
    },
    set : function(obj, cb){
        var me = this;
        me.persist(obj, function(e, table){
            if(e){
                cb(e);
            }else{
//                console.log('TableStore: table modified - ', table);
                cb(null, table);
            }
        });
    },
    getByAttr : function(key, val, cb){
        var matches = [], matched;
        this.retrieve(function(e, entities){
            if(e){
                return cb(e);
            }
            if(key == '*' && val == '*'){
                cb(null, entities);
            }else{
                for(var entity in entities){
                    if(util.isArray(key)){
                        matched = true;
                        for(var i=key.length;i--;){
                            if(entities[entity][key[i]] != val[i]){
                                matched = false;
                            }
                        }
                        if(matched){
                            matches.push(entities[entity]);
                        }
                    }else if(entities[entity][key] == val){
                        matches.push(entities[entity]);
                    }
                }
                cb(null, matches.length == 0 ? null : (matches.length == 1 ? matches[0] : matches));
            }
        });
    },
    persist : function(row, cb){
        var me = this;
        me.retrieve(function(e, entities){
            entities[row.id] = entities[row.id] || {};
            for(var key in row){
                entities[row.id][key] = row[key];
            }
            fs.writeFile(me.store, JSON.stringify(entities, undefined, 4), function(e2){
                if(e2){
                    return cb('error writing file: ' + e2);
                }else{
                    cb(null, entities[row.id]);
                }
            });
        });
    },
    retrieve : function(cb){
        fs.readFile(this.store, 'utf8', function(e, content){
            if(e){
                return cb('error loading file: ' + e);
            }
            if(content.trim().length == 0){
                content = {};
            }else{
                content = JSON.parse(content);
            }
            cb(null, content);
        });
    }
};