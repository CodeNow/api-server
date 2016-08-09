var express = require('express');
var app = module.exports = express();
var me = require('middleware/me');
var utils = require('middleware/utils');
var containers = require('middleware/containers');
var harbourmaster = require('middleware/harbourmaster');
var parallel = require('middleware-flow').parallel;
var query = require('dat-middleware').query;
var keypather = require('keypather')();
var pluck = require('101/pluck');

app.get('/runnables/active',
  me.isAdmin,
  containers.findRunningContainers,
  containers.respond
);
