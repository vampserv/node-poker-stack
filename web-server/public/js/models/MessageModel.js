define(["jquery", "backbone"], function($, Backbone){
    var View = Backbone.Model.extend({
        urlRoot : '/rest/messages'
    });
    return View;
});