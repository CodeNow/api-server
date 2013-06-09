apiserver = require '../lib'
configs = require '../lib/configs'
sa = require 'superagent'

describe 'tagging api', ->

  it 'should be able to ::tag a runnable that a user owns', (done) ->
    user = sa.agent()
    oldSalt = apiserver.configs.passwordSalt
    delete apiserver.configs.passwordSalt
    user.post("http://localhost:#{configs.port}/login")
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: 'matchusername5', password: 'testing' }))
      .end (err, res) ->
        res.should.have.status 200
        process.nextTick ->
          user.post("http://localhost:#{configs.port}/runnables")
            .end (err, res) ->
              if err then done err else
                res.should.have.status 201
                userId = res.body.owner
                runnableId = res.body._id
                tagText = 'mytag'
                process.nextTick ->
                  user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                    .set('content-type', 'application/json')
                    .send(JSON.stringify(name: tagText))
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 201
                        res.should.have.property 'body'
                        res.body.should.have.property 'name', tagText
                        res.body.should.have.property '_id'
                        apiserver.configs.passwordSalt = oldSalt
                        done()

  it 'should not be able to ::tag a runnable that a user doenst own', (done) ->
    user = sa.agent()
    oldSalt = apiserver.configs.passwordSalt
    delete apiserver.configs.passwordSalt
    user.post("http://localhost:#{configs.port}/runnables")
      .end (err, res) ->
        if err then done err else
          res.should.have.status 201
          userId = res.body.owner
          runnableId = res.body._id
          user.post("http://localhost:#{configs.port}/login")
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ username: 'matchusername5', password: 'testing' }))
            .end (err, res) ->
              res.should.have.status 200
              process.nextTick ->
                tagText = 'mytag'
                process.nextTick ->
                  user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                    .set('content-type', 'application/json')
                    .send(JSON.stringify(name: tagText))
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 403
                        res.should.have.property 'body'
                        res.body.should.have.property 'message', 'permission denied'
                        apiserver.configs.passwordSalt = oldSalt
                        done()


  it 'should alow admins to ::tag a runnable that they do not own', (done) ->
    user = sa.agent()
    oldSalt = apiserver.configs.passwordSalt
    delete apiserver.configs.passwordSalt
    user.post("http://localhost:#{configs.port}/runnables")
      .end (err, res) ->
        if err then done err else
          res.should.have.status 201
          userId = res.body.owner
          runnableId = res.body._id
          user.post("http://localhost:#{configs.port}/login")
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ username: 'test4@testing.com', password: 'testing' }))
            .end (err, res) ->
              res.should.have.status 200
              process.nextTick ->
                tagText = 'mytag'
                process.nextTick ->
                  user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                    .set('content-type', 'application/json')
                    .send(JSON.stringify(name: tagText))
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 201
                        apiserver.configs.passwordSalt = oldSalt
                        done()

  it 'should not be able to ::tag a runnable as an anonymous user', (done) ->
    user = sa.agent()
    user.post("http://localhost:#{configs.port}/runnables")
      .end (err, res) ->
        if err then done err else
          res.should.have.status 201
          userId = res.body.owner
          runnableId = res.body._id
          tagText = 'mytag'
          process.nextTick ->
            user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
              .set('content-type', 'application/json')
              .send(JSON.stringify(name: tagText))
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 403
                  res.should.have.property 'body'
                  res.body.should.have.property 'message', 'permission denied'
                  done()

  it 'should be able to list ::tags of a runnable', (done) ->
    user = sa.agent()
    oldSalt = apiserver.configs.passwordSalt
    delete apiserver.configs.passwordSalt
    user.post("http://localhost:#{configs.port}/login")
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: 'matchusername5', password: 'testing' }))
      .end (err, res) ->
        res.should.have.status 200
        process.nextTick ->
          user.post("http://localhost:#{configs.port}/runnables")
            .end (err, res) ->
              if err then done err else
                res.should.have.status 201
                userId = res.body.owner
                runnableId = res.body._id
                tagText = 'mytag'
                process.nextTick ->
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
                              apiserver.configs.passwordSalt = oldSalt
                              done()

  it 'should be able to remove a ::tag in your own runnable', (done) ->
    user = sa.agent()
    oldSalt = apiserver.configs.passwordSalt
    delete apiserver.configs.passwordSalt
    user.post("http://localhost:#{configs.port}/login")
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: 'matchusername5', password: 'testing' }))
      .end (err, res) ->
        res.should.have.status 200
        process.nextTick ->
          user.post("http://localhost:#{configs.port}/runnables")
            .end (err, res) ->
              if err then done err else
                res.should.have.status 201
                userId = res.body.owner
                runnableId = res.body._id
                tagText = 'mytag'
                process.nextTick ->
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
                              apiserver.configs.passwordSalt = oldSalt
                              done()

  it 'should not be able to remove a ::tag in someone elses runnable', (done) ->
    user = sa.agent()
    oldSalt = apiserver.configs.passwordSalt
    delete apiserver.configs.passwordSalt
    user.post("http://localhost:#{configs.port}/login")
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: 'matchusername5', password: 'testing' }))
      .end (err, res) ->
        res.should.have.status 200
        process.nextTick ->
          user.post("http://localhost:#{configs.port}/runnables")
            .end (err, res) ->
              if err then done err else
                res.should.have.status 201
                userId = res.body.owner
                runnableId = res.body._id
                tagText = 'mytag'
                process.nextTick ->
                  user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                    .set('content-type', 'application/json')
                    .send(JSON.stringify(name: tagText))
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 201
                        tagId = res.body._id
                        user.post("http://localhost:#{configs.port}/login")
                          .set('Content-Type', 'application/json')
                          .send(JSON.stringify({ username: 'test@testing.com', password: 'testing' }))
                          .end (err, res) ->
                            res.should.have.status 200
                            process.nextTick ->
                              user.del("http://localhost:#{configs.port}/runnables/#{runnableId}/tags/#{tagId}")
                                .end (err, res) ->
                                  if err then done err else
                                    res.should.have.status 403
                                    res.body.should.have.property 'message', 'permission denied'
                                    apiserver.configs.passwordSalt = oldSalt
                                    done()

  it 'should allow admins to remove a ::tag from someone elses runnable', (done) ->
    user = sa.agent()
    oldSalt = apiserver.configs.passwordSalt
    delete apiserver.configs.passwordSalt
    user.post("http://localhost:#{configs.port}/login")
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: 'matchusername5', password: 'testing' }))
      .end (err, res) ->
        res.should.have.status 200
        process.nextTick ->
          user.post("http://localhost:#{configs.port}/runnables")
            .end (err, res) ->
              if err then done err else
                res.should.have.status 201
                userId = res.body.owner
                runnableId = res.body._id
                tagText = 'mytag'
                process.nextTick ->
                  user.post("http://localhost:#{configs.port}/runnables/#{runnableId}/tags")
                    .set('content-type', 'application/json')
                    .send(JSON.stringify(name: tagText))
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 201
                        tagId = res.body._id
                        user.post("http://localhost:#{configs.port}/login")
                          .set('Content-Type', 'application/json')
                          .send(JSON.stringify({ username: 'test4@testing.com', password: 'testing' }))
                          .end (err, res) ->
                            res.should.have.status 200
                            process.nextTick ->
                              user.del("http://localhost:#{configs.port}/runnables/#{runnableId}/tags/#{tagId}")
                                .end (err, res) ->
                                  if err then done err else
                                    res.should.have.status 200
                                    res.body.should.have.property 'message', 'tag deleted'
                                    apiserver.configs.passwordSalt = oldSalt
                                    done()


  it 'should be able to retrieve a ::tag by its own id', (done) ->
    user = sa.agent()
    oldSalt = apiserver.configs.passwordSalt
    delete apiserver.configs.passwordSalt
    user.post("http://localhost:#{configs.port}/login")
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: 'matchusername5', password: 'testing' }))
      .end (err, res) ->
        res.should.have.status 200
        process.nextTick ->
          user.post("http://localhost:#{configs.port}/runnables")
            .end (err, res) ->
              if err then done err else
                res.should.have.status 201
                userId = res.body.owner
                runnableId = res.body._id
                tagText = 'mytag'
                process.nextTick ->
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
                              apiserver.configs.passwordSalt = oldSalt
                              done()

  it 'should return tag not found if the ::tag id does not exist', (done) ->
      user = sa.agent()
      user.post("http://localhost:#{configs.port}/runnables")
        .end (err, res) ->
          if err then done err else
            res.should.have.status 201
            runnableId = res.body._id
            process.nextTick ->
              user.get("http://localhost:#{configs.port}/runnables/#{runnableId}/tags/12345")
                .end (err, res) ->
                  if err then done err else
                    res.should.have.status 404
                    res.body.should.have.property 'message', 'tag not found'
                    done()