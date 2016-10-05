var express = require('express');
var app = module.exports = express();
var tokens = require('middleware/tokens');
var me = require('middleware/me');
var utils = require('middleware/utils');

var body = require('middleware/body');
var containers = require('middleware/containers');
var or = utils.or;
var series  = utils.series;
var flow = require('middleware-flow');
var mwIf = flow.mwIf.bind(flow);

var getContainerForUpdateAccess = series(
  body.isObjectId64('containerId'),
  body.decodeId('containerId'),
  containers.findById('body.containerId', {
    _id: 1 ,
    owner:1,
    containerId:1,
    allowTerm: 1,
    servicesToken: 1
  }),
  containers.checkFound
);

app.get('/',
  tokens.hasToken,
  tokens.returnToken);

app.post('/',
  // get user_id if user has one.. but dont throw error
  utils.unless(tokens.hasToken, utils.next),
  body.ifExists('containerId', getContainerForUpdateAccess),
  me.login('body'),
  tokens.createToken,
  tokens.returnToken);
