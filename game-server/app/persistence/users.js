var uuid = require('node-uuid');
var util = require('util');
var fs = require('fs');

var UserStore = module.exports = {
    store  : './localstore/users.json',
    entity : 'users',
    create : function(obj, callback){
        var me = this;
        me.getByAttr('username', obj.username, false, function(e, existingUser){
            if(existingUser){
                callback('user-exists', existingUser);
            }else{
                var id = uuid.v1();
                me.persist({
                    id         : id,
                    username   : obj.username,
                    password   : obj.password,
                    email      : obj.email,
                    chips      : obj.chips,
                    wins       : 0,
                    largestWin : 0,
                    friends    : [],
                    created    : Date.now()
                }, function(e, user){
                    if(e){
                        callback(e);
                    }else{
                        callback(null, user);
                    }
                })
            }
        });
    },
    set : function(obj, cb){
        var me = this;
        me.persist(obj, function(e, entity){
            if(e){
                cb(e);
            }else{
                cb(null, safetyFilter(entity));
            }
        });
    },
    getByAttr : function(key, val, opts, cb){
        var matches = [], matched;
        opts = opts || {};
        this.retrieve(function(e, entities){
            if(e){
                return cb(e, []);
            }
            for(var entity in entities){
                if(util.isArray(key)){
                    matched = true;
                    for(var i=key.length;i--;){
                        if(entities[entity][key[i]] != val[i]){
                            matched = false;
                        }
                    }
                    if(matched){
                        matches.push(opts.getFullEntity ? entities[entity] : safetyFilter(entities[entity]));
                    }
                }else if(entities[entity][key] == val || (key == '*' && val == '*')){
                    matches.push(opts.getFullEntity ? entities[entity] : safetyFilter(entities[entity]));
                }
            }
            matches = opts.getArray ? matches : (matches.length == 0 ? null : (matches.length == 1 ? matches[0] : matches));
            cb(null, matches);
        });
    },
    getByIds : function(ary, cb){
        var matches = [];
        this.retrieve(function(e, entities){
            if(e){
                return cb(e, []);
            }
            for(var entity in entities){
                if(ary.indexOf(entities[entity].id) != -1){
                    matches.push(safetyFilter(entities[entity]));
                }
            }
            cb(null, matches);
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
                try{
                    content = JSON.parse(content);
                }catch(e){
                    console.log('parseerror');
                    content = content.slice(0, - 1);
                    content = JSON.parse(content);
                }
            }
            cb(null, content);
        });
    }
};

function safetyFilter(obj){
    return {
        id         : obj.id,
        username   : obj.username,
        email      : obj.email,
        chips      : obj.chips,
        wins       : obj.wins,
        largestWin : obj.largestWin,
        created    : obj.created
    }
}