'use strict';

var async = require('async');

var Runnable = require('runnable');
var host = 'http://runnable2.net:3030';

var ctx = {};

ctx.user = new Runnable(host);

async.series([
  registerUser,
  createProject,
], function (err) {
  if (err) {
    console.error(err);
    return process.exit(1);
  }
  console.log('done');
  process.exit(0);
});

function registerUser(cb) {
  ctx.user = ctx.user.register('accounts@runnable.com', 'runnableUser', 'asdfasdf', cb);
}

function createProject(cb) {
  var projectData = {
    name: 'my first project',
    description: 'my little pony',
    dockerfile: 'FROM ubuntu\n'
  };
  ctx.project = ctx.user.createProject({ json: projectData }, cb);
}