define(['jquery', 'backbone'], function($, Backbone){
    var View = Backbone.View.extend({
        el: '#register',
        initialize: function(options){
            var me = this;
            me.options = options;
            options.eventPubSub.bind('initRegisterView', function(){
                $('.app-view').hide();
                me.$el.show('fast');
            });
        },
        events: {
            'click #register-btn': 'register'
        },
        register: function(e){
            e.preventDefault();
            var me = this;
            var form = this.$el.find('form');
            var obj = utils.collect(form);
            me.options.game.register(obj, function(){
                Alerts.General.display({
                    title   : 'User Created',
                    content : 'Your username "'+obj.username+'" has been created. You will now be redirected to the login page.'
                });
                form.find('input').val('');
                Backbone.history.navigate('#/login');
            }, function(err){
                var content = '';
                if(err == 'user-exists')
                    content = 'The username "'+obj.username+'" you specified has already been taken. Please try another username.';
                Alerts.Error.display({
                    title   : 'Could Not Register',
                    content : content
                });
            });
        }
    });
    return View;
});
