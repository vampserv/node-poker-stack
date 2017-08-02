var pomelo = require('pomelo');
var routeUtil = require('./app/util/routeUtil');
var abuseFilter = require('./app/servers/game/filter/abuseFilter');
var tableComponent = require('./app/components/tableComponent');
var botComponent = require('./app/components/botComponent');
var stateComponent = require('./app/components/stateComponent');
var ChatService = require('./app/services/chatService');

var app = pomelo.createApp();
app.set('name', 'poker-game-stack');

app.configure('production|development', function(){
	app.route('game', routeUtil.game);
	app.filter(pomelo.timeout());
    app.set('session', require('../shared/config/session.json'));
});

app.configure('production|development', 'game', function(){
    app.filter(abuseFilter());
    app.load(tableComponent);
    app.load(botComponent);
//    app.load(stateComponent);
});

app.configure('production|development', 'chat', function(){
    app.set('chatService', new ChatService(app));
});

app.configure('production|development', function() {
	app.set('connectorConfig', {
		connector: pomelo.connectors.sioconnector,
		// 'websocket', 'polling-xhr', 'polling-jsonp', 'polling'
		transports: ['websocket', 'polling'],
		heartbeats: true,
		closeTimeout: 60 * 1000,
		heartbeatTimeout: 60 * 1000,
		heartbeatInterval: 25 * 1000
	});
});

//var timeReport = require('./app/module/timeReport');
//app.registerAdmin(timeReport, {app: app});

app.start();

process.on('uncaughtException', function(err){
	console.error('Caught exception: ' + err.stack);
});
