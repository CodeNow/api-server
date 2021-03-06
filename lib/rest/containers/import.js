var express = require('express');
var app = module.exports = express();
var path = require('path');
var me = require('middleware/me');
var query = require('middleware/query');
var images = require('middleware/images');
var containers = require('middleware/containers');
var channels = require('middleware/channels');
var utils = require('middleware/utils');
var files = require('middleware/files');
var docklet = require('middleware/docklet');
var harbourmaster = require('middleware/harbourmaster');
var mw = require('middleware-flow');

module.exports = function (baseUrl) {
  app.post(path.join(baseUrl, '/github'),
    query.require('githubUrl', 'stack'),
    docklet.create(),
    docklet.model.findDock(),
    images.createFromGithub('user_id', 'dockletResult', 'query.githubUrl', 'query.stack'),
    channels.findByName('query.stack'),
    mw.mwIf(channels.checkFound)
      .else(
        channels.create({name: 'query.stack'}),
        channels.model.save()),
    images.model.addTagByName('query.stack'),
    images.model.addSelfToRevisions(),
    containers.create({
      owner: 'user_id'
    }),
    containers.model.inheritFromImage('image', {
      parent: undefined,
      importSource: 'query.githubUrl'
    }),
    utils.if(me.isRegistered,
      containers.model.set('saved', true)),
    harbourmaster.createContainer('image', 'container'),
    containers.model.save(),
    files.sync,
    containers.respond);

  return app;
};
