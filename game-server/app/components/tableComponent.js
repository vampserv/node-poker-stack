var TableService = require('../services/tableService');

module.exports = function(app, opts){
  var service = new TableService(app, opts);
  app.set('tableService', service, true);
  service.name = '__table__';
  return service;
};