apiserver = require '../lib'
configs = require '../lib/configs'
helpers = require './helpers'
sa = require 'superagent'

describe 'tagging api', ->

  it 'should be able to ::tag a runnable that a user owns', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedRegisteredUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                tagText = 'mytag'
                user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                  .set('content-type', 'application/json')
                  .send(JSON.stringify(name: tagText))
                  .end (err, res) ->
                    if err then done err else
                      res.should.have.status 201
                      res.should.have.property 'body'
                      res.body.should.have.property 'name', tagText
                      res.body.should.have.property '_id'
                      instance.stop done

  it 'should not be able to ::tag a runnable that a user doenst own', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                helpers.authedRegisteredUser (err, user2) ->
                  if err then done err else
                    tagText = 'mytag'
                    user2.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                      .set('content-type', 'application/json')
                      .send(JSON.stringify(name: tagText))
                      .end (err, res) ->
                        if err then done err else
                          res.should.have.status 403
                          res.should.have.property 'body'
                          res.body.should.have.property 'message', 'permission denied'
                          instance.stop done

  it 'should alow admins to ::tag a runnable that they do not own', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              helpers.authedAdminUser (err, user) ->
                if err then done err else
                  tagText = 'mytag'
                  user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                    .set('content-type', 'application/json')
                    .send(JSON.stringify(name: tagText))
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 201
                        instance.stop done

  it 'should not be able to ::tag a runnable as an anonymous user', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                tagText = 'mytag'
                user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                  .set('content-type', 'application/json')
                  .send(JSON.stringify(name: tagText))
                  .end (err, res) ->
                    if err then done err else
                      res.should.have.status 403
                      res.should.have.property 'body'
                      res.body.should.have.property 'message', 'permission denied'
                      instance.stop done

  it 'should be able to list ::tags of a runnable', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedRegisteredUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                tagText = 'mytag'
                user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                  .set('content-type', 'application/json')
                  .send(JSON.stringify(name: tagText))
                  .end (err, res) ->
                    if err then done err else
                      res.should.have.status 201
                      tagId = res.body._id
                      user.get("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                        .end (err, res) ->
                          if err then done err else
                            res.body.should.be.a.array
                            res.body.length.should.equal 1
                            res.body[0].should.have.property 'name', tagText
                            res.body[0].should.have.property '_id', tagId
                            instance.stop done

  it 'should be able to remove a ::tag in your own runnable', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedRegisteredUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                tagText = 'mytag'
                user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                  .set('content-type', 'application/json')
                  .send(JSON.stringify(name: tagText))
                  .end (err, res) ->
                    if err then done err else
                      res.should.have.status 201
                      tagId = res.body._id
                      user.del("http://localhost:#{configs.port}/runnables/#{runnableId}/tags/#{tagId}")
                        .end (err, res) ->
                          if err then done err else
                            res.should.have.status 200
                            res.body.should.have.property 'message', 'tag deleted'
                            instance.stop done

  it 'should not be able to remove a ::tag in someone elses runnable', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedRegisteredUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                tagText = 'mytag'
                user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                  .set('content-type', 'application/json')
                  .send(JSON.stringify(name: tagText))
                  .end (err, res) ->
                    if err then done err else
                      res.should.have.status 201
                      tagId = res.body._id
                      helpers.authedUser (err, user) ->
                        if err then done err else
                          user.del("http://localhost:#{configs.port}/runnables/#{runnableId}/tags/#{tagId}")
                            .end (err, res) ->
                              if err then done err else
                                res.should.have.status 403
                                res.body.should.have.property 'message', 'permission denied'
                                instance.stop done

  it 'should allow admins to remove a ::tag from someone elses runnable', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedRegisteredUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                tagText = 'mytag'
                user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                  .set('content-type', 'application/json')
                  .send(JSON.stringify(name: tagText))
                  .end (err, res) ->
                    if err then done err else
                      res.should.have.status 201
                      tagId = res.body._id
                      helpers.authedAdminUser (err, user) ->
                        if err then done err else
                          user.del("http://localhost:#{configs.port}/runnables/#{runnableId}/tags/#{tagId}")
                            .end (err, res) ->
                              if err then done err else
                                res.should.have.status 200
                                res.body.should.have.property 'message', 'tag deleted'
                                instance.stop done

  it 'should be able to retrieve a ::tag by its own id', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        user = sa.agent()
        helpers.authedRegisteredUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                tagText = 'mytag'
                user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                  .set('content-type', 'application/json')
                  .send(JSON.stringify(name: tagText))
                  .end (err, res) ->
                    if err then done err else
                      res.should.have.status 201
                      tagId = res.body._id
                      user.get("http://localhost:#{configs.port}/runnables/#{runnableId}/tags/#{tagId}")
                        .end (err, res) ->
                          if err then done err else
                            res.should.have.status 200
                            res.body.should.have.property '_id', tagId
                            res.body.should.have.property 'name', tagText
                            instance.stop done

  it 'should return tag not found if the ::tag id does not exist', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            helpers.createUserImage user, 'node.js', (err, runnableId) ->
              if err then done err else
                user.get("http://localhost:#{configs.port}/runnables/#{runnableId}/tags/12345")
                  .end (err, res) ->
                    if err then done err else
                      res.should.have.status 404
                      res.body.should.have.property 'message', 'tag not found'
                      instance.stop done

  it 'should be able to ::tag a ::container that a user owns', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.createContainer 'node.js', (err, user, runnableId) ->
          if err then done err else
            tagText = 'mytag'
            user.post("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags")
              .set('content-type', 'application/json')
              .send(JSON.stringify(name: tagText))
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  res.should.have.property 'body'
                  res.body.should.have.property 'name', tagText
                  res.body.should.have.property '_id'
                  instance.stop done

  it 'should be able to list ::tags of a ::container', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.createContainer 'node.js', (err, user, runnableId) ->
          if err then done err else
            tagText = 'mytag'
            user.post("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags")
              .set('content-type', 'application/json')
              .send(JSON.stringify(name: tagText))
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  res.should.have.property 'body'
                  res.body.should.have.property 'name', tagText
                  res.body.should.have.property '_id'
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.be.a.array
                        res.body.length.should.equal 1
                        res.body[0].should.have.property 'name', tagText
                        res.body[0].should.have.property '_id'
                        instance.stop done

  it 'should be able to remove a ::tag in your own ::container', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.createContainer 'node.js', (err, user, runnableId) ->
          if err then done err else
            tagText = 'mytag'
            user.post("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags")
              .set('content-type', 'application/json')
              .send(JSON.stringify(name: tagText))
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  res.should.have.property 'body'
                  res.body.should.have.property 'name', tagText
                  res.body.should.have.property '_id'
                  tagId = res.body._id
                  user.del("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags/#{tagId}")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.have.property 'message', 'tag deleted'
                        instance.stop done

  it 'should be able to retrieve a ::containers ::tag by its own id', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.createContainer 'node.js', (err, user, runnableId) ->
          if err then done err else
            tagText = 'mytag'
            user.post("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags")
              .set('content-type', 'application/json')
              .send(JSON.stringify(name: tagText))
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  res.should.have.property 'body'
                  res.body.should.have.property 'name', tagText
                  res.body.should.have.property '_id'
                  tagId = res.body._id
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags/#{tagId}")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.have.property 'name', tagText
                        res.body.should.have.property '_id'
                        instance.stop done

  it 'should return tag not found if the ::tag id does not exist for a ::container', (done) ->
    helpers.createServer configs, done, (err, instance) ->
      if err then done err else
        helpers.createContainer 'node.js', (err, user, runnableId) ->
          if err then done err else
            tagText = 'mytag'
            user.post("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags")
              .set('content-type', 'application/json')
              .send(JSON.stringify(name: tagText))
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  res.should.have.property 'body'
                  res.body.should.have.property 'name', tagText
                  res.body.should.have.property '_id'
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{runnableId}/tags/12345")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 404
                        res.body.should.have.property 'message', 'tag not found'
                        instance.stop done