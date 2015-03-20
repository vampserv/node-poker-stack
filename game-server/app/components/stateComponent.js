var BotService = require('../services/stateService');

module.exports = function(app, opts){
  var service = new StateService(app, opts);
  app.set('stateService', service, true);
  service.name = '__state__';
  return service;
};