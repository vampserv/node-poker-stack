var exp = module.exports;
var dispatcher = require('./dispatcher');

exp.game = function(session, msg, app, cb){
	var gameServers = app.getServersByType('game');
	if(!gameServers || gameServers.length === 0){
		cb(new Error('can not find game servers.'));
		return;
	}
	var res = dispatcher.dispatch(1, gameServers);
	cb(null, res.id);
};