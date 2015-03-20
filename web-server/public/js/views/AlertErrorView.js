define(['jquery', 'backbone'], function($, Backbone){
    var View = Backbone.View.extend({
        initialize: function(){
            this.setElement('#error-alert');
            $(this.el).modal({
                show     : false,
                keyboard : true,
                backdrop : true
            });
        },
        display: function(vars, failback, onClose){
            if(vars){
                $(this.el).modal('show');
                $(this.el).find('.modal-title').html(vars.title);
                $(this.el).find('.modal-body').html(vars.content);
            }
            if(typeof failback == typeof Function){
                failback();
            }
            if(typeof onClose == typeof Function){
                $(this.el).unbind('hidden').on('hidden', onClose);
            }
        }
    });
    return View;
});