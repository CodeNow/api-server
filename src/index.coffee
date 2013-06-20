configs = require './configs'
express = require 'express'
http = require 'http'
mongoose = require 'mongoose'
runnables = require './rest/runnables'
users = require './rest/users'
channels = require './rest/channels'

mongoose.connect configs.mongo

app = express()

if configs.logRequests then app.use express.logger()
app.use express.bodyParser()
app.use users
app.use runnables
app.use channels
app.use app.router
app.use (err, req, res, next) ->
  if err && err.msg and err.code
    res.json err.code, message: err.msg
  else
    if err
      logErr = err
    if err.err
      logErr = err.err
    console.log(logErr)
    console.log(logErr.message)
    console.log(logErr.stack)
    res.json 500, { message: 'something bad happened' }

app.get '/', (req, res) -> res.json { message: 'hello!' }
app.get '/throws', -> throw new Error 'zomg'
app.all '*', (req, res) -> res.json 404, { message: 'operation not found' }

server = http.createServer app

module.exports =
  configs: configs
  start: (cb) ->
    server.listen process.env.PORT || configs.port, cb
  stop: (cb) ->
    server.close cb