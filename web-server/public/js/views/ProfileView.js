define(['jquery', 'backbone'], function($, Backbone){
    var View = Backbone.View.extend({
        el: '#profile',
        initialize: function(options){
            var me = this;
            me.options = options;
            options.eventPubSub.bind('initProfileView', function(){
                $('.app-view').hide();
                me.$el.show('fast');
                me.getPlayerInfo(function(user){
                    me.renderProfile(user);
                    me.renderStats(user);
                })
            });
        },
        events: {
            'click #save-profile-btn': 'saveProfile',
            'click #update-password-btn': 'updatePassword'
        },
        getPlayerInfo: function(cb){
            pomelo.request('game.userHandler.getUsers', '', function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('userHandler.getUsers', res);
                    cb(res.matches[0]);
                }
            });
        },
        renderProfile: function(user){
            $('#profile-container').html(_.template($('#ProfileUpdateTmpl').html(), {
                user : user
            }));
        },
        renderStats: function(user){
            $('#user-stats-container').html(_.template($('#UserStatsTmpl').html(), {
                user : user
            }));
        },
        saveProfile: function(e){
            e.preventDefault();
            var form = $('#profile-form');
            var obj = utils.collect(form);
            pomelo.request('game.userHandler.setProfile', obj, function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('userHandler.setProfile', res);
                    Alerts.General.display({
                        title   : 'Profile Updated',
                        content : 'Your profile information has been updated.'
                    });
                }
            });
        },
        updatePassword: function(e){
            e.preventDefault();
            var form = $('#password-form');
            var obj = utils.collect(form);
            if(obj.password !== obj.password2){
                Alerts.General.display({
                    title   : 'Password Update Failed',
                    content : 'The confirmation password did not match the password you specified.'
                });
                return;
            }
            pomelo.request('game.userHandler.setPassword', obj, function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('userHandler.setPassword', res);
                    form.find('input').val('');
                    Alerts.General.display({
                        title   : 'Profile Updated',
                        content : 'Your profile information has been updated.'
                    });
                }
            });
        }
    });
    return View;
});
