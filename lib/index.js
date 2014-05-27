var configs = require('configs');
var http = require('http');
var mongoose = require('mongoose');
mongoose.connect(configs.mongo);

function App() {
  this.create();
}

App.prototype.start = function (cb) {
  var self = this;
  mongoose.connection.once('connected', function() {
    self.server.listen(configs.port, configs.ipaddress, cb);
  });
};

App.prototype.create = function () {
  var self = this;
  var app = require('./app');
  this.server = http.createServer(app);

  return this.server;
};

App.prototype.stop = function (cb) {
  this.server.close(cb);
};

module.exports = App;