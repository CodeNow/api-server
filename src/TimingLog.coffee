_ = require('lodash')
uuid = require 'node-uuid'

equal = (a, b) ->
  _.isEqual(a, b) or
  a.toString() is b.toString() or
  (a.indexOf and ~a.indexOf(b)) or
  (b.indexOf and ~b.indexOf(a)) or
  (a.indexOf and ~a.indexOf(b.toString()))

timingLog = (equalVal) ->
  @uuid = uuid.v4()
  @timing = require('timing')()
  @equalVal = equalVal or ['UZKDAYo3XEw2AACX', '519283018a375c4c36000097']
  return @

timingLog.prototype.start = (val, name) ->
  if not equal(this.equalVal, val) then return
  console.log "TIMER-START:::#{name}"
  @timing.clear(name)
  @timing.time(name)

timingLog.prototype.end = (val, name) ->
  if not equal(@equalVal, val) then return
  console.log "TIMER-END:::#{name}"
  console.log "TIMER-DURATION:::#{name}:::"+@timing.timeEnd(name).duration


create = module.exports.create = (eqVal) ->
  new timingLog(eqVal)