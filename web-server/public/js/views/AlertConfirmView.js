define(['jquery', 'backbone'], function($, Backbone){
    var View = Backbone.View.extend({
        initialize: function(){
            this.setElement('#confirm-alert');
            $(this.el).modal({
                show     : false,
                keyboard : true,
                backdrop : true
            });
        },
        events: {
            "click button.submit": "doConfirm"
        },
        display: function(vars, callback){
            if(vars && typeof callback === typeof Function){
                $(this.el).modal('show');
                $(this.el).find('.modal-title').html(vars.title);
                $(this.el).find('.modal-body').html(vars.content);
                this.callback = callback;
            }
        },
        doConfirm: function(vars){
            $(this.el).modal('hide');
            this.callback();
        }
    });
    return View;
});