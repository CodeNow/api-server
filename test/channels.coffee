apiserver = require '../lib'
configs = require '../lib/configs'
helpers = require './helpers'
sa = require 'superagent'

describe 'channels api', ->

  it 'should list out the ::channels', (done) ->
    user = sa.agent()
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.createUser user, (err, token) ->
          user.get("http://localhost:#{configs.port}/channels")
            .set('runnable-token', token)
            .end (err, res) ->
              if err then done err else
                res.should.have.status 200
                res.body.should.be.a.array
                res.body.should.includeEql
                  name: 'facebook'
                  _id: 'facebook'
                res.body.should.includeEql
                  name: 'google'
                  _id: 'google'
                res.body.should.includeEql
                  name: 'twitter'
                  _id: 'twitter'
                res.body.should.includeEql
                  name: 'jquery'
                  _id: 'jquery'
                instance.stop done

  it 'should not list out blank ::channels', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedRegisteredUser (err, user) ->
          if err then cb err else
            user.post("http://localhost:#{configs.port}/runnables?from=node.js")
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  runnableId = res.body._id
                  user.get("http://localhost:#{configs.port}/channels")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.be.a.array
                        instance.stop done