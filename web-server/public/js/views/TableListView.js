define(['jquery', 'backbone'], function($, Backbone){
    var View = Backbone.View.extend({
        el: '#tables',
        initialize: function(options){
            var me = this;
            me.options = options;
            options.eventPubSub.bind('initTableListView', function(){
                $('.app-view').hide();
                me.$el.show('fast');
                me.tableDom = $('#table-list');
                me.getTables();
                me.options.eventPubSub.trigger('getFriendList');
                me.newTableContainer = $('#create-table-container');
                $('#messenger-area').html('');
                me.renderNewTable();
            });
        },
        events: {
            'click #register-btn': 'register',
            'click #create-table-btn': 'createTable',
            'click .join-table-btn': 'joinTable',
            'click #sync-table-list': 'getTables'
        },
        getTables: function(){
            var me = this;
            pomelo.request('game.tableHandler.getTables', '', function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('getTables', res);
                    me.renderTables(res.tables);
                }
            });
        },
        renderTables: function(tables){
            this.tableDom.html(_.template($('#TableListTmpl').html(), tables));
        },
        renderNewTable: function(){
            this.newTableContainer.html(_.template($('#newTableTmpl').html()));
        },
        createTable: function(e){
            e.preventDefault();
            var me = this;
            pomelo.request('game.tableHandler.createTable', utils.collect(this.newTableContainer), function(res){
                if(res.code != 200){
                    console.log('error', res.error);
                }else{
                    console.log('createTable', res);
                    me.getTables();
//                Backbone.history.navigate('#/table');
                }
            });
        },
        joinTable: function(e){
            e.preventDefault();
            var tid = $(e.currentTarget).closest('tr').attr('did');
            if(tid){
                Backbone.history.navigate('#/table/'+tid);
            }
        }
    });
    return View;
});
