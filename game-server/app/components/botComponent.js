var BotService = require('../services/botService');

module.exports = function(app, opts){
  var service = new BotService(app, opts);
  app.set('botService', service, true);
  service.name = '__bot__';
  return service;
};