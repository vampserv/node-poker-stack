define(['jquery', 'backbone'], function($, Backbone){
    var View = Backbone.View.extend({
        initialize: function(){
            this.setElement('#general-alert');
            $(this.el).modal({
                show     : false,
                keyboard : true,
                backdrop : true
            });
        },
        display: function(vars, url, timeout){
            var me = this;
            me.redirected = false;
            if(vars){
                $(me.el).modal('show');
                $(me.el).find('.modal-title').html(vars.title);
                $(me.el).find('.modal-body').html(vars.content);
                if(url){
                    $('.modal-alert button').click(function(){
                        $(this).unbind('click');
                        me.redirected = true;
                        Backbone.history.navigate(url);
                    });
                    me.autoRedirect(url, timeout);
                }
            }
        },
        autoRedirect: function(url, timeout){
            var me = this;
            setTimeout(function(){
                if(!me.redirected){
                    Backbone.history.navigate(url);
                }
            }, timeout || 3000);
        }
    });
    return View;
});