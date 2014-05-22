var configs = require('configs');
var http = require('http');
var mongoose = require('mongoose');
var nodetime = require('nodetime');
var rollbar = require('rollbar');
var hour = 1000 * 60 * 60;
var path = require('path');
mongoose.connect(configs.mongo);
if (configs.rollbar) {
  rollbar.init(configs.rollbar, {
    environment: process.env.NODE_ENV || "development",
    branch: "master",
    root: path.resolve(__dirname, '..')
  });
}

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
  var app = require('./app');
  this.server = http.createServer(app);

  process.on('uncaughtException', function ExceptionListener (err) {
    process.removeListener('uncaughtException', ExceptionListener);
    console.error('uncaughtException', err);
    self.stop(self.gracefulExit);
  });
  
  return this.server;
};

App.prototype.stop = function (cb) {
  this.server.close(cb);
};

/* private */
var gracefulExit = function () {
  if (configs.nodetime) {
    nodetime.destroy();
  }
  if (configs.rollbar) {
    rollbar.shutdown();
  }
  process.exit();
};

module.exports = App;