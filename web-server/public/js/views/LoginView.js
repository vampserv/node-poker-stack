define(['jquery', 'backbone'], function($, Backbone){
    var View = Backbone.View.extend({
        el: '#login',
        initialize: function(options){
            var me = this;
            me.options = options;
            options.eventPubSub.bind('initLoginView', function(){
                $('.app-view').hide();
                me.$el.show('fast');
                me.formDom = me.$el.find('form');
                me.formDom.val('');
            });
        },
        events: {
            'click #login-btn': 'login'
        },
        login: function(e){
            e.preventDefault();
            var me = this;
            var obj = utils.collect(me.formDom);
            me.options.game.connect(obj, function(e){
                if(e){
                    var content = e;
                    if(e == 'invalid-user')
                        content = 'The credentials you specified were invalid. Please try again.';
                    else if(e == 'duplicate-session')
                        content = 'You are already logged in from another machine.';
                    Alerts.Error.display({
                        title   : 'Could Not Login',
                        content : content
                    });
                    return;
                }
                me.formDom.find('input').val('');
                Backbone.history.navigate('#/tables');
            });
        }
    });
    return View;
});
