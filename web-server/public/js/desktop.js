
require.config({
    paths : {
        "jquery"            : "libs/jquery",
        "underscore"        : "libs/underscore",
        "backbone"          : "libs/backbone-min",
        "bootstrap"         : "libs/bootstrap.min",
        "pomeloclient"      : "libs/pomeloclient",
        "socketio"          : "libs/socket.io",
        "resources"         : 'libs/resources'

    },
    shim : {
        "bootstrap"  : {
            "deps"    : ["jquery"]
        },
        "backbone" : {
            deps : ['bootstrap', 'pomeloclient', 'socketio']
        }
    }
});
require(['jquery', 'backbone', 'routers/desktopRouter', 'bootstrap', 'resources'], function($, Backbone, Desktop){
    this.router = new Desktop();
});