define([
    'jquery',
    'backbone',
    'views/AlertGeneralView',
    'views/AlertConfirmView',
    'views/AlertErrorView',
    'views/GlobalView',
    'views/LoginView',
    'views/RegisterView',
    'views/TableListView',
    'views/TableView',
    'views/ProfileView'
], function($, Backbone, AlertGeneralView, AlertConfirmView, AlertErrorView, GlobalView, LoginView, RegisterView, TableListView, TableView, ProfileView){
    // bind alerts
    Alerts.General = new AlertGeneralView();
    Alerts.Confirm = new AlertConfirmView();
    Alerts.Error = new AlertErrorView();
    // main router
    var Router = Backbone.Router.extend({
        initialize: function(){
            // establish event pub/sub
            this.eventPubSub = _.extend({}, Backbone.Events);
            this.game = new GameClient();
            var gv = new GlobalView({game:this.game, eventPubSub:this.eventPubSub});
            var lv = new LoginView({game:this.game, eventPubSub:this.eventPubSub});
            var rv = new RegisterView({game:this.game, eventPubSub:this.eventPubSub});
            var tlv = new TableListView({game:this.game, eventPubSub:this.eventPubSub});
            var tv = new TableView({game:this.game, eventPubSub:this.eventPubSub});
            var pv = new ProfileView({game:this.game, eventPubSub:this.eventPubSub});
            Backbone.history.start();
        },
        routes: {
            ''          : 'tables',
            'login'     : 'login',
            'register'  : 'register',
            'profile'   : 'profile',
            'tables'    : 'tables',
            'table/:id' : 'table'
        },
        login: function(){
            var me = this;
            me.connect(function(){
                me.eventPubSub.trigger('initLoginView');
            });
        },
        register: function(){
            var me = this;
            me.connect(function(){
                me.eventPubSub.trigger('initRegisterView');
            });
        },
        profile: function(){
            var me = this;
            me.connect(function(){
                me.auth(function(){
                    me.eventPubSub.trigger('initProfileView');
                });
            });
        },
        tables: function(){
            var me = this;
            me.connect(function(){
                me.auth(function(){
                    me.eventPubSub.trigger('initTableListView');
                });
            });
        },
        table: function(id){
            var me = this;
            me.connect(function(){
                me.auth(function(){
                    me.eventPubSub.trigger('initTableView', {
                        tid : id
                    });
                });
            });
        },
        connect: function(callback){
            if(!this.game.connection.host){
                this.game.getEntry(callback);
            }else{
                callback();
            }
        },
        auth: function(callback){
            if(!this.game.session.user){
                $('.username-placeholder').html('');
                $('.chips-placeholder').html('');
                $('.authed-section').hide();
                $('.unauthed-section').show();
                Backbone.history.navigate('#/login');
            }else{
                $('.username-placeholder').html(this.game.session.user.username);
                $('.chips-placeholder').html(this.game.session.user.chips);
                $('.unauthed-section').hide();
                $('.authed-section').show();
                callback();
            }
        }
    });
    return Router;
});
var Alerts = {};