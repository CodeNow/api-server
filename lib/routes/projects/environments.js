'use strict';

/**
 * Project Environments API
 * @module rest/projects/environments
 */

var express = require('express');
var app = module.exports = express();

var mw = require('dat-middleware');
var flow = require('middleware-flow');
var me = require('middlewares/me');
var projects = require('middlewares/mongo').projects;
var validations = require('middlewares/validations');

var findProject = flow.series(
  mw.params('id').require().validate(validations.isObjectId),
  projects.findById('params.id'),
  projects.checkFound);

/* *** ENVIRONMENTS *** */

/** Create an environment on a {@link module:models/project Project}
 *  @param {ObjectId} id ID of the Project to which to add an environment
 *  @param {object} body
 *  @param {string} body.name Proposed name of the new environment
 *  @returns {object} The {@link module:models/project project}, and new environment
 *  @event POST rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.post('/:id/environments',
  findProject,
  flow.or(
    projects.model.isPublic(),
    me.isOwnerOf('project'),
    me.isModerator),
  // FIXME: add some validation of body.name
  mw.body('name', 'default', 'environmentId').pick(),
  mw.body('name').require(),
  mw.body().set('owner', 'userId'),
  mw.body('environmentId').require()
    .then(
      projects.model.createAndSaveEnvFromEnvId('body', 'body.environmentId'))
    .else(
      projects.model.createAndSaveEnvFromDefault('body')),
  mw.res.json(201, 'project.lastEnv()')
);

/** Get a Project's environment
 *  @param {ObjectId} id ID of the project to fetch
 *  @param {ObjectId} envId ID of the environment to delete
 *  @returns 200 (w/ no content)
 *  @event DELETE rest/projects/:id/environments/:envId
 *  @memberof module:rest/projects/environments */
app.get('/:id/environments/:envId',
  findProject,
  flow.or(
    me.isOwnerOf('project'),
    me.isModerator),
  projects.model.findEnvById('params.envId'),
  mw.res.json('project.findEnvById(params.envId).toJSON()'));

/** List the environments of a {@link module:models/project Project}
 *  @returns {object} body
 *  @returns {ObjectId} body._id ID of the Project
 *  @returns {array.object} body.environments Environments of the project
 *  @returns {ObjectId} body.environments.context Context belonging to the environment
 *  @returns {ObjectId} body.environments.version Version of the given Context
 *  @event GET rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.get('/:id/environments',
  findProject,
  flow.or(
    projects.model.isPublic(),
    me.isOwnerOf('project'),
    me.isModerator),
  mw.res.json('project.environments'));

/** Update an environment on a {@link module:models/project Project}
 *  @param {ObjectId} id ID of the Project to which to add an view
 *  @param {ObjectId} envId ID of the environment of which to update
 *  @returns {object} The {@link module:models/project project}, with updated environment
 *  @event PATCH rest/projects/:id/environment/:envId
 *  @memberof module:rest/projects/environments */
app.patch('/:id/environments/:envId',
  findProject,
  flow.or(
    me.isOwnerOf('project'),
    me.isModerator),
  mw.body('name').require().pick(),
  projects.model.updateEnvById('params.envId', 'body'),
  mw.res.json('project.findEnvById(params.envId)'));

/** Delete a Project's environment
 *  @param {ObjectId} id ID of the project to fetch
 *  @param {ObjectId} envId ID of the environment to delete
 *  @returns 204 (w/ no content)
 *  @event DELETE rest/projects/:id/environments/:envId
 *  @memberof module:rest/projects/environments */
app.del('/:id/environments/:envId',
  findProject,
  flow.or(
    me.isOwnerOf('project'),
    me.isModerator),
  projects.model.removeEnvById('params.envId'),
  mw.res.send(204));

/* *** PROTECTED ROUTES *** */

/*  @returns {error} 405 - not allowed
 *  @event PATCH rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.patch('/:id/environments/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event PUT rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.put('/:id/environments/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event DELETE rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.delete('/:id/environments/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event GET rest/projects/:id/environments/:envId
 *  @memberof module:rest/projects/environments */
app.get('/:id/environments/:envId', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event POST rest/projects/:id/environments/:envId
 *  @memberof module:rest/projects/environments */
app.post('/:id/environments/:envId', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event PUT rest/projects/:id/environments/:envId
 *  @memberof module:rest/projects/environments */
app.put('/:id/environments/:envId', function (req, res) { res.send(405); });