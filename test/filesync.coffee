apiserver = require '../lib'
configs = require '../lib/configs'
helpers = require './helpers'
sa = require 'superagent'

describe 'file sync feature', ->

  it 'should not ::sync shell files when building an image from dockerfile', (done) ->
    helpers.createImage 'node.js', (err, runnableId) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            user.post("http://localhost:#{configs.port}/users/me/runnables?from=#{runnableId}")
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  userRunnableId = res.body._id
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.be.a.array
                        for elem in res.body
                          elem.name.should.not.equal '.bashrc'
                          elem.name.should.not.equal '.profile'
                        done()

  it 'should ::sync missing files when building an image from dockerfile', (done) ->
    helpers.createImage 'missing_file', (err, runnableId) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            user.post("http://localhost:#{configs.port}/users/me/runnables?from=#{runnableId}")
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  userRunnableId = res.body._id
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.be.a.array
                        res.body.should.have.length 4
                        done()

  it 'should ::sync missing folders when building an image from dockerfile', (done) ->
    helpers.createImage 'missing_folder', (err, runnableId) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            user.post("http://localhost:#{configs.port}/users/me/runnables?from=#{runnableId}")
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  userRunnableId = res.body._id
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.be.a.array
                        res.body.should.have.length 5
                        done()

  it 'should ::sync files inside folders when building an image from dockerfile', (done) ->
    helpers.createImage 'file_in_folder', (err, runnableId) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            user.post("http://localhost:#{configs.port}/users/me/runnables?from=#{runnableId}")
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  userRunnableId = res.body._id
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.be.a.array
                        found = false
                        for elem in res.body
                          if elem.name is 'sub_file.js' and elem.path is '/sub_dir'
                            found = true
                        found.should.equal true
                        done()

  it 'should not ::sync files inside ignored folders when building an image from dockerfile', (done) ->
    helpers.createImage 'node.js_express', (err, runnableId) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            user.post("http://localhost:#{configs.port}/users/me/runnables?from=#{runnableId}")
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  userRunnableId = res.body._id
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        res.body.should.be.a.array
                        for elem in res.body
                          elem.path.should.not.include 'node_modules'
                        done()

  it 'should read ::synced file data from mongodb entry for the container', (done) ->
    helpers.createImage 'node.js', (err, runnableId) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            user.post("http://localhost:#{configs.port}/users/me/runnables?from=#{runnableId}")
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  userRunnableId = res.body._id
                  res.body.should.have.property 'token'
                  token = res.body.token
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        fileId = null
                        for elem in res.body
                          if elem.name is 'server.js'
                            file_id = elem._id
                        user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files/#{file_id}")
                          .end (err, res) ->
                            if err then done err else
                              res.should.have.status 200
                              res.body.should.have.property 'content'
                              content = res.body.content
                              terminalUrl = "http://terminals.runnableapp.dev/term.html?termId=#{token}"
                              helpers.sendCommand terminalUrl, 'echo overwrite > server.js', (err, output) ->
                                if err then done err else
                                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files/#{file_id}")
                                    .end (err, res) ->
                                      if err then done err else
                                        res.should.have.status 200
                                        res.body.should.have.property 'content', content
                                        done()

  it 'should ::sync out of ::band container file changes with an explicit sync() call', (done) ->
    helpers.createImage 'node.js', (err, runnableId) ->
      if err then done err else
        helpers.authedUser (err, user) ->
          if err then done err else
            user.post("http://localhost:#{configs.port}/users/me/runnables?from=#{runnableId}")
              .end (err, res) ->
                if err then done err else
                  res.should.have.status 201
                  userRunnableId = res.body._id
                  res.body.should.have.property 'token'
                  token = res.body.token
                  terminalUrl = "http://terminals.runnableapp.dev/term.html?termId=#{token}"
                  user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files")
                    .end (err, res) ->
                      if err then done err else
                        res.should.have.status 200
                        fileId = null
                        for elem in res.body
                          if elem.name is 'server.js'
                            file_id = elem._id
                        user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files/#{file_id}")
                          .end (err, res) ->
                            if err then done err else
                              res.should.have.status 200
                              res.body.should.have.property 'content'
                              content = res.body.content
                              ### IMPORTANT - HIT THE DISK SO WE ACTIVATE THE CONTAINER ###
                              user.post("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/sync")
                                .end (err, res) ->
                                  if err then done err else
                                    res.should.have.status 201
                                    terminalUrl = "http://terminals.runnableapp.dev/term.html?termId=#{token}"
                                    helpers.sendCommand terminalUrl, 'echo overwrite > server.js', (err, output) ->
                                      if err then done err else
                                        user.post("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/sync")
                                          .end (err, res) ->
                                            if err then done err else
                                              res.should.have.status 201
                                              user.get("http://localhost:#{configs.port}/users/me/runnables/#{userRunnableId}/files/#{file_id}")
                                                .end (err, res) ->
                                                  if err then done err else
                                                    res.should.have.status 200
                                                    res.body.should.have.property 'content'
                                                    encodedOverwrite = (new Buffer('overwrite\n')).toString('base64')
                                                    res.body.content.should.equal encodedOverwrite
                                                    done()

  ### NEXT ITERATION ###

  it 'should ::sync container changes automatically when publishing to an image'
  it 'should read ignored file contents directly from disk, without ::syncing'
  it 'should write file changes for ignored files directly to container volume without ::syncing'