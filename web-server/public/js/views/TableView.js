define(['jquery', 'backbone', 'collections/UserCollection', 'models/UserModel'], function($, Backbone, UserCollection, UserModel){
    var View = Backbone.View.extend({
        el: '#dashboard',
        initialize: function(options){
            var me = this;
            me.options = options;
            me.userlist = me.$el.find('.list-group');
            me.chatarea = me.$el.find('#chat-area');
            me.historyarea = me.$el.find('#history-area');
            me.countdownDom = $('#countdown-placeholder');
            me.timeout = {};
            me.bindEvents();
            me.channel = new UserCollection();
            options.eventPubSub.bind('initTableView', function(params){
                if(!params || !params.tid)
                    Backbone.history.navigate('#/tables');
                $('.app-view').hide();
                me.$el.show('fast');
                me.$el.find('textarea').val('');
                me.gameSession = undefined;
                me.resetCountDown();
                me.historyarea.html('');
                me.actionIndex = 0;
                me.joinTable(params.tid, function(){
                    me.renderGame();
                });
            });
        },
        events: {
            'click #login-btn': 'login',
            'click .list-group-item': 'showMemberProfile',
            'keypress #chat-container textarea': 'submitMessage',
            'click #join-game-btn': 'joinGame',
            'click #start-game-btn': 'startGame',
            'click .game-action': 'doAction',
            'click #create-new-game-btn': 'resetGame',
            'click #leave-table-btn': 'leaveTable',
            'click #remove-bots-btn': 'removeBots'
        },
        showMemberProfile: function(e){
            e.preventDefault();
            var dom = $(e.currentTarget);
            if(dom.attr('data-original-title')){
                return;
            }
            pomelo.request('game.userHandler.getUsers', {
                name : 'id',
                val  : dom.attr('did')
            }, function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('userHandler.getUsers', res);
                    dom.popover({
                        html    : true,
                        trigger : 'click',
                        content : function(){
                            return _.template($('#UserStatsTmpl').html(), {
                                user : res.matches[0] || {}
                            });
                        }
                    });
                    dom.popover('toggle');
                }
            });
        },
        goBack: function(e){
            e.preventDefault();
            window.history.back();
        },
        buildUserList: function(){
            this.userlist.html(_.template($('#UserListItem').html(), {
                items  : this.channel.models,
                userId : this.options.game.session.user.id
            }));
        },
        bindEvents: function(){
            var me = this;
            pomelo.on('onUpdateUsers', function(data){
                console.log('onUpdateUsers', data.members);
                me.channel = new UserCollection(data.members);
                me.buildUserList();
            });
            pomelo.on('onChat', function(data){
                console.log('onChat', data);
                me.addMessage(data.username, data.msg);
            });
            pomelo.on('onAdd', function(data){
                console.log('onAdd', data);
                me.channel.add(data.user);
                me.buildUserList();
                me.updateHistory('<b>'+data.user.username+'</b> joined table');
            });
            pomelo.on('onLeave', function(data){
                console.log('onLeave', data);
                me.channel.remove(data.user.id);
                me.removePlayerFromGame(data.user.id);
                me.buildUserList();
                me.renderGame();
                me.updateHistory('<b>'+data.user.username+'</b> left table');
            });
            pomelo.on('disconnect', function(reason){
                console.log('disconnect', reason);
            });
            pomelo.on('onTableJoin', function(data){
                console.log('onTableJoin', data);
                me.gameSession.playersToAdd.push(data.msg);
                me.renderGame();
                me.updateHistory('<b>'+data.msg.playerName+'</b> sat down');
            });
            pomelo.on('onTableEvent', function(data){
                console.log('onTableEvent', data);
                me.gameSession = data.msg;
                me.handleTimeout();
                me.renderGame();
                if(me.gameSession.actions.length == 0)
                    me.actionIndex = 0;
                while(me.actionIndex < me.gameSession.actions.length){
                    var action = me.gameSession.actions[me.actionIndex];
                    me.updateHistory('<b>'+action.playerName+'</b> performed <b>'+action.action
                        +'</b>'+(action.amount ? (' for <b>'+action.amount+'</b> chips') : ''));
                    ++me.actionIndex;
                }
                if(me.gameSession.gameWinners.length){
                    for(var i=0;i<me.gameSession.gameWinners.length;++i){
                        var winner = me.gameSession.gameWinners[i];
                        me.updateHistory('<b>'+winner.playerName+'</b> wins <b>'+winner.amount+'</b> chips');
                    }
                }
            });
        },
        handleTimeout: function(){
            var me = this;
            if(me.gameSession.state == 'JOIN')
                me.resetCountDown();
            if(me.gameSession.state == 'IN_PROGRESS' && (me.timeout.gid !== me.gameSession.id || me.timeout.tid !== me.gameSession.tid || me.timeout.player !== me.gameSession.currentPlayer)){
                me.resetCountDown();
                me.timeout = {
                    player : me.gameSession.currentPlayer,
                    gid    : me.gameSession.id,
                    tid    : me.gameSession.tid,
                    count  : me.gameSession.gameMode == 'normal' ? 30 : 15,
                    ref    : me.initCountdown()
                };
            }
        },
        initCountdown: function(){
            var me = this;
            me.resetCountDown();
            return setInterval(function(){
                if(typeof me.gameSession.currentPlayer == 'number'){
                    me.countdownDom.html(--me.timeout.count+' seconds left for <b>'+me.gameSession.players[me.gameSession.currentPlayer].playerName+'</b>');
                }
                if(me.timeout.count <= 0 || typeof me.gameSession.currentPlayer != 'number')
                    me.resetCountDown();
            }, 1000);
        },
        resetCountDown: function(){
            this.countdownDom.html('');
            clearInterval(this.timeout.ref);
        },
        removePlayerFromGame: function(uid){
            var i;
            if(this.gameSession){
                for(i in this.gameSession.players)
                    if(this.gameSession.players[i].id === uid)
                        this.gameSession.playersToRemove.push(i);
                for(i in this.gameSession.playersToAdd)
                    if(this.gameSession.playersToAdd[i].id === uid)
                        this.gameSession.playersToAdd.splice(i, 1);
            }
        },
        submitMessage: function(e){
            var me = this;
            if(e.keyCode != 13) return;
            var msg = $(e.currentTarget);
            if($.trim(msg.val()).length > 0){
                this.options.game.sendMessage(msg.val(), 'table', function(e){
                    if(e){
                        me.addMessage('System', (e == 'user-not-online' ? 'user is not online.' : e), null, 'error');
                    }
                    msg.scrollTop(msg[0].scrollHeight);
                    msg.val('');
                });
            }
        },
        addMessage: function(username, text, time){
            if(time == null){
                time = new Date();
            }else if((time instanceof Date) === false){
                time = new Date(time);
            }
            this.chatarea.append(_.template($('#ChatMessageItem').html(), {
                date : utils.timeString(time),
                user : username,
                msg  : utils.toStaticHTML(text)
            }));
            this.chatarea.scrollTop(this.chatarea[0].scrollHeight);
        },
        renderGame: function(){
            $('#poker-container .panel-body').html(_.template($('#CurrentGameView').html(), {
                gameSession : this.gameSession,
                user        : this.options.game.session.user,
                convertCard : this.convertCard,
                timeout     : this.timeout
            }));
        },
        joinTable: function(tid){
            var me = this;
            pomelo.request('game.tableHandler.joinTable', {
                tid : tid
            }, function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('joinTable', res);
                    me.options.game.session.tid = res.tid;
                }
            });
        },
        leaveTable: function(e){
            e.preventDefault();
            var me = this;
            pomelo.request('game.tableHandler.leaveTable', '', function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('leaveTable', res);
                    delete me.options.game.session.tid;
                    me.channel.reset();
                    Backbone.history.navigate('#/tables');
                }
            });
        },
        resetGame: function(){
            delete this.gameSession;
            this.renderGame();
        },
        joinGame: function(e){
            e.preventDefault();
            pomelo.request('game.tableHandler.joinGame', {
                buyIn : this.$el.find('input[name="user-buyin-input"]').val()
            }, function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('joinGame', res);
                }
            });
        },
        startGame: function(e){
            e.preventDefault();
            pomelo.request('game.tableHandler.startGame', '', function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('startGame', res);
                }
            });
        },
        doAction: function(e){
            var me = this;
            var params = {
                action : $(e.currentTarget).attr('did')
            };
            if(params.action == 'bet')
                params.amt = me.$el.find('input[name="betAmount"]').val();
            pomelo.request('game.tableHandler.execute', params, function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('execute', res);
                    if(params.action == 'bet')
                        me.$el.find('input[name="betAmount"]').val('');
                }
            });
        },
        convertCard: function(card){
            var str = '';
            switch(card[0]){
                case 'J': str += 'jack'; break;
                case 'Q': str += 'queen'; break;
                case 'K': str += 'king'; break;
                case 'A': str += 'ace'; break;
                case 'T': str += '10'; break;
                default : str += card[0]; break;
            }
            str += '_of_';
            switch(card[1]){
                case 'D': str += 'diamonds'; break;
                case 'S': str += 'spades'; break;
                case 'C': str += 'clubs'; break;
                case 'H': str += 'hearts'; break;
            }
            return str += '.png';
        },
        updateHistory: function(msg){
            this.historyarea.append('<div>'+msg+'</div>');
            this.historyarea.scrollTop(this.historyarea[0].scrollHeight);
        },
        removeBots: function(){
            pomelo.request('game.tableHandler.removeBots', '', function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('removed');
                }
            });
        }
    });
    return View;
});
