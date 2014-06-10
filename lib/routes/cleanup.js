'use strict';

var express = require('express');
var app = module.exports = express();
var me = require('middlewares/me');
var utils = require('middlewares/utils');
var containers = require('middlewares/containers');
var harbourmaster = require('middlewares/harbourmaster');
var parallel = require('middleware-flow').parallel;
var query = require('dat-middleware').query;
var pluck = require('101/pluck');

var week = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
var unsavedAndVeryOld = {
  saved: false,
  created: {$lte: week}
};

app.get('/',
  me.isModerator,
  query('firstRun').require()
    .then(containers.remove(unsavedAndVeryOld)),
  containers.findSavedOrActive({
    owner: 1,
    servicesToken: 1,
    host: 1,
    containerId: 1
  }),
  containers.getOwnersFor('containers', {
    permission_level: 1,
    _id: 1
  }),
  // filterContainersWithRegisteredOwner,
  pluckAndSetContainerIds,
  parallel(
    containers.remove({ _id: { $nin: 'containerIds' } }),
    harbourmaster.cleanupContainers('containers')
  ),
  utils.message('successfuly sent prune request to harbourmaster and cleaned mongodb'));


function filterContainersWithRegisteredOwner (req, res, next) {
  req.containers = req.containers.filter(function (container) {
    return container.ownerJSON.registered;
  });
  next();
}

function pluckAndSetContainerIds (req, res, next) {
  var containers = req.containers;
  req.containerIds = containers.map(pluck('_id'));
  next();
}