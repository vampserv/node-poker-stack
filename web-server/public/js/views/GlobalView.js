define(['jquery', 'backbone'], function($, Backbone){
    var View = Backbone.View.extend({
        el: 'body',
        initialize: function(options){
            var me = this;
            me.options = options;
            me.bindGlobalEvents();
            me.selectedFriend = undefined;
            me.messageContainer = $('#messenger-input-container');
            me.friendModal = $('#add-friend-alert');
            me.friendList = $('#friend-list');
            me.messageArea = $('#messenger-area');
            me.msgs = {};
            me.options.eventPubSub.bind('getFriendList', function(){
                me.messageArea.html('');
                me.getFriends();
            });
        },
        events: {
            'click .goBack': 'goBack',
            'click #nav-logout-btn': 'logout',
            'click #friend-list li': 'selectChatFriend',
            'keypress #messenger-chatbox': 'submitFriendMessage',
            'click #show-add-friend-modal-btn': 'showAddFriendModal',
            'click #search-friends-btn': 'findFriend',
            'click #add-friend-btn': 'addFriend',
            'click #sync-friend-list': 'getFriends'
        },
        goBack: function(e){
            e.preventDefault();
            window.history.back();
        },
        logout: function(){
            this.options.game.disconnect();
            $('.username-placeholder').html('');
            $('.chips-placeholder').html('');
            $('.authed-section').hide();
            $('.unauthed-section').show();
            Backbone.history.navigate('#/login');
        },
        bindGlobalEvents: function(){
            var me = this;
            pomelo.on('onUpdateMyself', function(data){
                console.log('onUpdateMyself', data.user);
                me.options.game.session.user.chips = data.user.chips || me.options.game.session.user.chips;
                me.options.game.session.user.username = data.user.username || me.options.game.session.user.username;
                $('.username-placeholder').text(me.options.game.session.user.username);
                $('.chips-placeholder').text(me.options.game.session.user.chips);
            });
            pomelo.on('onUserChat', function(res){
                console.log('onUserChat', res);
                me.addMessage(res.username, res.username, res.msg);
            });
        },
        selectChatFriend: function(e){
            var item = $(e.currentTarget);
            if(!item.attr('did')){
                return false;
            }
            $('#friend-list li').removeClass('active');
            item.addClass('active');
            this.selectedFriend = $.trim(item.text());
            this.messageContainer.show();
            this.renderMessages();
        },
        renderMessages: function(){
            this.msgs[this.selectedFriend] = this.msgs[this.selectedFriend] || [];
            this.messageArea.html(_.template($('#ChatMessageList').html(), {
                items : this.msgs[this.selectedFriend]
            }));
        },
        submitFriendMessage: function(e){
            if(e.keyCode != 13) return;
            var me = this;
            var msg = $(e.currentTarget);
            if($.trim(msg.val()).length > 0 && me.selectedFriend){
                me.addMessage(me.selectedFriend, 'Me', msg.val());
                me.options.game.sendMessage(msg.val(), me.selectedFriend, function(e){
                    if(e){
                        me.addMessage(me.selectedFriend, 'System', (e == 'user-not-online' ? 'user is not online.' : e), null, 'error');
                    }
                    msg.scrollTop(msg[0].scrollHeight);
                    msg.val('');
                });
            }
        },
        addMessage: function(context, username, text, time, type){
            if(time == null){
                time = new Date();
            }else if((time instanceof Date) === false){
                time = new Date(time);
            }
            var message = {
                date : utils.timeString(time),
                user : username,
                msg  : utils.toStaticHTML(text),
                type : type || ''
            };
            this.msgs[context] = this.msgs[context] || [];
            this.msgs[context].push(message);
            this.messageArea.append(_.template($('#ChatMessageItem').html(), message));
            this.messageArea.scrollTop(this.messageArea[0].scrollHeight);
        },
        showAddFriendModal: function(){
            this.friendModal.find('input').val('');
            this.friendModal.find('#friend-results-list').html('');
            this.friendModal.modal('show');
        },
        findFriend: function(){
            var me = this;
            var search = this.friendModal.find('input');
            var friendList = this.friendModal.find('#friend-results-list');
            friendList.html('');
            pomelo.request('game.userHandler.getUsers', {
                name : 'username',
                val  : search.val()
            }, function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('userHandler.getUsers', res);
                    me.renderUserList(friendList, res.matches, true);
                }
            });
        },
        renderUserList: function(dom, friends, showCheckbox){
            dom.html(_.template($('#FriendListTmpl').html(), {
                friends      : friends,
                showCheckbox : showCheckbox
            }));
        },
        addFriend: function(){
            var me = this;
            var friendList = this.friendModal.find('#friend-results-list');
            var fid = friendList.find('input:checked').closest('li').attr('did');
            pomelo.request('game.userHandler.addFriend', {
                friend : fid
            }, function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('chatHandler.addFriend', res);
                    me.friendModal.modal('hide');
                }
            });
        },
        getFriends: function(){
            var me = this;
            pomelo.request('chat.chatHandler.getFriends', '', function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('getFriends', res);
                    me.renderUserList(me.friendList, res.friends);
                }
            });
        }
    });
    return View;
});

function GameClient(){
    this.connection = {};
    this.session = {};
    this.table = {};
}
/* gate handling */
GameClient.prototype.getEntry = function(cb){
    var me = this;
    pomelo.init({
        host : window.location.hostname,
        port : 3014,
        log  : true
    }, function(){
        pomelo.request('gate.gateHandler.queryEntry', {}, function(data){
            console.log('queryEntry', data);
            me.connection = data;
            pomelo.disconnect();
            cb(data);
        });
    });
};
/* user management */
GameClient.prototype.register = function(userObj, cb, fb){
    var me = this;
    me.init(function(){
        pomelo.request('connector.entryHandler.register', userObj, function(res){
            if(res.code == 500){
                fb(res.error);
            }else{
                console.log('register', res);
                cb();
            }
        });
    });
};
GameClient.prototype.connect = function(userObj, cb){
    var me = this;
    me.init(function(){
        pomelo.request('connector.entryHandler.connect', userObj, function(res){
            if(res.code != 200){
                cb(res.error);
            }else{
                console.log('connect', res);
                me.session.token = res.token;
                me.session.user = res.user;
                cb();
            }
        });
    });
};
GameClient.prototype.disconnect = function(){
    this.session = {};
    pomelo.disconnect();
};
GameClient.prototype.init = function(cb){
    pomelo.init({
        host : this.connection.host,
        port : this.connection.port,
        log  : true
    }, function(socket){
        console.log('init', socket);
        cb(socket);
    });
};
GameClient.prototype.sendMessage = function(msg, target, cb, fb){
    pomelo.request('chat.chatHandler.sendMessage', {
        content : msg,
        target  : target
    }, function(res){
        cb(res.error);
    });
};