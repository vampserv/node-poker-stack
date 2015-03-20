define(["jquery", "backbone", "models/MessageModel"], function($, Backbone, MessageModel){
    var Collection = Backbone.Collection.extend({
        model : MessageModel,
        url   : 'messages'
    });
    return Collection;
});