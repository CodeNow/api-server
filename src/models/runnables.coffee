async = require 'async'
caching = require './caching'
channels = require './channels'
configs = require '../configs'
containers = require './containers'
domain = require 'domain'
error = require '../error'
images = require './images'
users = require './users'
implementations = require './implementations'
_ = require 'lodash'
ObjectId = require('mongoose').Types.ObjectId
request = require 'request'

listFields =
  _id:1,
  name:1,
  tags:1,
  owner:1,
  created:1,
  votes:1,
  views:1,
  copies:1,
  runs:1

Runnables =

  createImageFromDisk: (domain, userId, runnablePath, sync, cb) ->
    images.createFromDisk domain, userId, runnablePath, sync, (err, image, tags) ->
      if err then cb err else
        async.forEach tags, (tag, cb) ->
          channels.findOne aliases: tag.toLowerCase(), domain.intercept (channel) ->
            if channel
              image.tags.push channel: channel._id
              cb()
            else
              channels.createImplicitChannel domain, tag, (err, channel) ->
                if err then cb err else
                  image.tags.push channel: channel._id
                  cb()
        , (err) ->
          if err then throw err
          image.save domain.intercept () ->
            users.findUser domain, _id: userId, (err, user) ->
              if err then cb err else
                if not user then cb error 404, 'user not found' else
                  user.addVote domain, image._id, (err) ->
                    if err then cb err else
                      json_image = image.toJSON()
                      delete json_image.files
                      if json_image.parent then json_image.parent = encodeId json_image.parent
                      json_image._id = encodeId image._id
                      cb null, json_image
                      caching.markCacheAsDirty()

  createImage: (domain, userId, from, sync, cb) ->
    if not isObjectId64 from then cb error 404, 'source runnable not found' else
      containers.findOne _id: decodeId(from), domain.intercept (container) ->
        if not container then cb error 403, 'source runnable not found' else
          if container.owner.toString() isnt userId then cb error 403, 'permission denied' else
            images.createFromContainer domain, container, (err, image) ->
              if err then cb err else
                container.target = image._id
                container.save domain.intercept () ->
                  users.findUser domain, _id: userId, (err, user) ->
                    if err then cb err else
                      if not user then cb error 404, 'user not found' else
                        user.addVote domain, image._id, (err) ->
                          if err then cb err else
                            json_image = image.toJSON()
                            delete json_image.files
                            if json_image.parent then json_image.parent = encodeId json_image.parent
                            json_image._id = encodeId image._id
                            cb null, json_image
                            caching.markCacheAsDirty()

  createContainer: (domain, userId, from, cb) ->
    async.waterfall [
      (cb) ->
        if isObjectId64 from
          images.findOne _id: decodeId(from), domain.intercept (image) ->
            if not image then cb error 400, 'could not find source image to fork from' else
              cb null, image
        else
          options =
            sort: { _id: 1 }
            limit: 1
          channels.findOne aliases: from.toLowerCase(), domain.intercept (channel) ->
            if not channel then cb error 400, 'could not find channel by that name' else
              useOldestProject = () ->
                images.find 'tags.channel': channel._id, null, options, domain.intercept (images) ->
                  if not images.length then cb error 400, "could not find runnable in #{tags.name} to fork from" else
                    cb null, images[0]
              if not channel.base then useOldestProject() else
                images.findById channel.base, domain.intercept (image) ->
                  if not image then useOldestProject() else
                    cb null, image

      (image, cb)->
        containers.create domain, userId, image, (err, container) ->
          if err then cb err else
            json_container = container.toJSON()
            _.extend json_container, { running: false }
            encode domain, json_container, cb
    ], cb

  listContainers: (domain, userId, parent, cb) ->
    query = { owner: userId, saved: true }
    if parent then query.parent = decodeId parent
    containers.find query, domain.intercept (containers) ->
      async.map containers, (item, cb) ->
        json = item.toJSON()
        encode domain, json, cb
      , cb

  migrateContainers: (domain, userId, targetUserId, cb) ->
    containers.update { owner: userId }, { $set: owner: targetUserId }, domain.intercept () ->
      cb()

  getContainer: (domain, userId, runnableId, cb) ->
    runnableId = decodeId runnableId
    if not isObjectId runnableId
      cb error, 404, 'runnable not found'
    else
      containers.findOne _id: runnableId, domain.intercept (container) ->
        if not container
          cb error 404, 'runnable not found'
        else if container.owner.toString() isnt userId.toString()
          cb error 403, 'permission denied'
        else if container.status not in ['Draft', 'Editing']
          json = container.toJSON()
          encode domain, json, cb
        else
          container.getRunningState domain, (err, state) ->
            if err then cb err else
              json = container.toJSON()
              _.extend json, state
              encode domain, json, cb

  removeContainer: (domain, userId, runnableId, cb) ->
    runnableId = decodeId runnableId
    remove = () -> containers.destroy domain, runnableId, cb
    containers.findOne _id: runnableId, domain.intercept (container) ->
      if not container then cb error 404, 'runnable not found' else
        if container.owner.toString() is userId.toString() then remove() else
          users.findUser domain, _id: userId, (err, user) ->
            if err then cb err else
              if not user then cb error 404, 'user not found' else
                if user.permission_level <= 1 then cb error 403, 'permission denied' else
                  remove()

  removeImage: (domain, userId, runnableId, cb) ->
    runnableId = decodeId runnableId
    remove = () -> images.destroy domain, runnableId, cb
    images.findOne _id: runnableId, domain.bind (err, image) ->
      if err then throw err
      if not image then cb error 404, 'runnable not found' else
        if image.owner.toString() is userId.toString() then remove() else
          users.findUser domain, _id: userId, (err, user) ->
            if err then cb err else
              if not user then cb error 404, 'user not found' else
                if user.permission_level <= 1 then cb error 403, 'permission denied' else
                  for vote in user.votes
                    if vote.runnable.toString() is image._id.toString()
                      vote.remove()
                  remove()

  updateContainer: (domain, userId, runnableId, updateSet, token, cb) ->
    runnableId = decodeId runnableId
    containers.findOne _id: runnableId, domain.intercept (container) ->
      save = ->
        _.extend container, updateSet
        container.save domain.intercept ->
          json = container.toJSON()
          encode domain, json, cb
      commit = ->
        encode domain, _.extend(container, updateSet).toJSON(), domain.intercept (json) ->
          request
            pool: false
            url: "#{configs.harbourmaster}/containers/#{container.servicesToken}/commit"
            method: 'POST'
            json: json
            headers:
              'runnable-token': token
          , domain.intercept (res) ->
            if (res.statusCode isnt 204)
              cb error 502, "Error committing: #{JSON.stringify(res.body)}"
            else
              save()
      if not container
        cb error 404, 'runnable not found'
      else if container.owner.toString() isnt userId.toString()
        cb error 403, 'permission denied'
      else if updateSet.status is 'Committing new'
        images.findOne name: updateSet.name or container.name, domain.intercept (existing) =>
          if existing
            cb error 403, 'a shared runnable by that name already exists'
          else
            commit()
      else if updateSet.status is 'Committing back'
        commit()
      else
        console.log 'NOT COMMITTING'
        save()

  updateImage: (domain, userId, runnableId, from, cb) ->
    runnableId = decodeId runnableId
    from = decodeId from
    images.findOne _id: runnableId, domain.intercept (image) ->
      if not image then cb error 404, 'published runnable does not exist' else
        update = (su) ->
          containers.findOne _id: from, domain.intercept (container) ->
            if not container then cb error 403, 'source container to copy from does not exist' else
              if not su and container.owner.toString() isnt image.owner.toString()
                cb error 400, 'source container owner does not match image owner'
              else
                image.updateFromContainer domain, container, (err) ->
                  if err then cb err else
                    encode domain, image.toJSON(), cb
        if image.owner.toString() is userId then update false else
          users.findUser domain, _id: userId, (err, user) ->
            if err then cb err else
              if not user then cb error 404, 'user not found' else
                if user.permission_level < 5 then cb error 403, 'permission denied' else
                  update true

  getImage: (domain, runnableId, cb) ->
    if not isObjectId64 runnableId then cb error 404, 'runnable not found' else
      decodedRunnableId = decodeId runnableId
      images.findOne {_id: decodedRunnableId}, {files:0}, domain.intercept (image) =>
        if not image then cb error 404, 'runnable not found' else
          json_project = image.toJSON()
          encode domain, json_project, cb

  startContainer: (domain, userId, runnableId, cb) ->
    runnableId = decodeId runnableId
    containers.findOne {_id: runnableId}, {files:0}, domain.intercept (container) ->
      if not container then cb error 404, 'runnable not found' else
        if container.owner.toString() isnt userId.toString() then cb error 403, 'permission denied' else
          start = () ->
            container.updateRunOptionsAndStart domain, (err) ->
              if err then cb err else
                container.save domain.intercept () ->
                  json_project = container.toJSON()
                  encode domain, json_project, cb
        if container.specification?
            implementations.findOne
              owner: userId
              implements: container.specification
            , domain.intercept (implementation) ->
              if not implementation?
                cb error 400, 'no implementation'
              else
                start()
          else
            start()

  stopContainer: (domain, userId, runnableId, cb) ->
    runnableId = decodeId runnableId
    containers.findOne {_id: runnableId}, {files:0}, domain.intercept (container) ->
      if not container then cb error 404, 'runnable not found' else
        if container.owner.toString() isnt userId.toString()
          cb error 403, 'permission denied'
        else
          container.stop domain, (err) ->
            if err then cb err else
              json_project = container.toJSON()
              _.extend json_project, { running: false }
              encode domain, json_project, cb

  getVotes: (domain, runnableId, cb) ->
    runnableId = decodeId runnableId
    users.find('votes.runnable': runnableId).count().exec domain.intercept (count) ->
      cb null, { count: count - 1 }

  vote: (domain, userId, runnableId, cb) ->
    runnableId = decodeId runnableId
    async.series [
      (cb) ->
        images.isOwner domain, userId, runnableId, (err, isOwner) ->
          if (isOwner) then cb error 403, 'cannot vote for own runnables' else cb()
      (cb) ->
        users.addVote domain, userId, runnableId, cb
      (cb) ->
        images.incVote domain, runnableId, cb
    ], (err, results) ->
      if err? then cb err else
        vote = results[1]
        cb null, vote

  listAll: (domain, sort, limit, page, cb) ->
    query = images.find({}, listFields).sort(sort).skip(page*limit).limit(limit)
    countQuery = images.find({}, listFields).sort(sort).skip(page*limit).limit(limit).count()

    async.parallel
      images:(cb) ->
        query.exec domain.intercept (images) ->
          arrayToJSON(domain, images, cb)
      count:(cb) ->
        countQuery.exec domain.intercept (count) -> cb(null, count)

    , (err, results) ->
      if err then cb err else
        lastPage = Math.ceil(results.count/limit) - 1
        cb null, results.images, lastPage:lastPage

  listByPublished: (domain, sort, limit, page, cb) ->
    @listFiltered domain, { tags: $not: $size: 0 }, sort, limit, page, null, cb

  listByChannelMembership: (domain, channelIds, sort, limit, page, cb) ->
    @listFiltered domain, 'tags.channel': $in: channelIds, sort, limit, page, null, cb

  listByOwner: (domain, owner, sort, limit, page, cb) ->
    fields = _.clone listFields
    _.extend fields,
      copies:1
      pastes:1
      cuts:1
      runs:1
      views:1
    @listFiltered domain, { owner: owner }, sort, limit, page, fields, cb

  listFiltered: (domain, query, sort, limit, page, fields, cb) ->
    fields = fields or listFields
    countQuery = images.find(query, fields).sort(sort).skip(page*limit).limit(limit).count()
    query = images.find(query, fields).sort(sort).skip(page*limit).limit(limit).lean()

    async.parallel
      images:(cb) ->
        query.exec domain.intercept (images) ->
          arrayToJSON(domain, images, cb)
      count:(cb) ->
        countQuery.exec domain.intercept (count) -> cb(null, count)

    , (err, results) ->
      if err then cb err else
        lastPage = Math.ceil(results.count/limit) - 1
        cb null, results.images, lastPage:lastPage

  listNames: (domain, cb) ->
    images.find(tags:$not:$size:0, {_id:1,name:1,tags:1}).exec domain.intercept (results) ->
      arrayToJSON domain, results, cb

  getTags: (domain, runnableId, cb) ->
    runnableId = decodeId runnableId
    images.findOne _id: runnableId, domain.intercept (image) ->
      if not image then cb error 404, 'runnable not found' else
        async.map image.tags, (tag, cb) ->
          json = tag.toJSON()
          channels.findOne _id: json.channel, domain.intercept (channel) ->
            if channel then json.name = channel.name
            cb null, json
        , cb

  getTag: (domain, runnableId, tagId, cb) ->
    runnableId = decodeId runnableId
    images.findOne _id: runnableId, domain.intercept (image) ->
      if not image then cb error 404, 'runnable not found' else
        tag = image.tags.id tagId
        if not tag then cb error 404, 'tag not found' else
          json = tag.toJSON()
          channels.findOne _id: json.channel, domain.intercept (channel) ->
            if channel then json.name = channel.name
            cb null, json

  addTag: (domain, userId, runnableId, text, cb) ->
    users.findUser domain, _id: userId, (err, user) ->
      if err then cb err else
        if not user then cb error 403, 'user not found' else
          if user.permission_level < 1 then cb error 403, 'permission denied' else
            runnableId = decodeId runnableId
            images.findOne _id: runnableId, domain.intercept (image) ->
              if not image then cb error 404, 'runnable not found' else
                add = () ->
                  channels.findOne aliases : text.toLowerCase(), domain.intercept (channel) ->
                    createTag = (channel, cb) ->
                      image.tags.push channel:channel._id
                      image.save domain.intercept () ->
                        newTag = (_.last image.tags).toJSON();
                        newTag.name = channel.name
                        cb null, newTag
                    if channel then createTag channel, cb else
                      channels.createImplicitChannel domain, text, (err, channel) ->
                        if err then cb err else createTag channel, cb
                if image.owner.toString() is userId.toString() then add() else
                  if user.permission_level > 1 then add() else
                    cb error 403, 'permission denied'

  removeTag: (domain, userId, runnableId, tagId, cb) ->
    runnableId = decodeId runnableId
    images.findOne _id: runnableId, domain.intercept (image) ->
      if not image then cb error 404, 'runnable not found' else
        if image.owner.toString() isnt userId.toString()
          users.findOne _id: userId, domain.intercept (user) ->
            if not user then cb error 403, 'user not found' else
              if user.permission_level < 2 then cb error 403, 'permission denied' else
                image.tags.id(tagId).remove()
                image.save domain.intercept () ->
                  cb()
        else
          image.tags.id(tagId).remove()
          image.save domain.intercept () ->
            cb()

  getContainerTags: (domain, runnableId, cb) ->
    runnableId = decodeId runnableId
    containers.findOne _id: runnableId, domain.intercept (container) ->
      if not container then cb error 404, 'runnable not found' else
        async.map container.tags, (tag, cb) ->
          json = tag.toJSON()
          channels.findOne _id: json.channel, domain.intercept (channel) ->
            if channel then json.name = channel.name
            cb null, json
        , cb

  getContainerTag: (domain, runnableId, tagId, cb) ->
    runnableId = decodeId runnableId
    containers.findOne _id: runnableId, domain.intercept (container) ->
      if not container then cb error 404, 'runnable not found' else
        tag = container.tags.id tagId
        if not tag then cb error 404, 'tag not found' else
          json = tag.toJSON()
          channels.findOne _id: json.channel, domain.intercept (channel) ->
            if channel then json.name = channel.name
            cb null, json

  addContainerTag: (domain, userId, runnableId, text, cb) ->
    users.findUser domain, _id: userId, (err, user) ->
      if err then cb err else
        if not user then cb error 403, 'user not found' else
          runnableId = decodeId runnableId
          containers.findOne _id: runnableId, domain.intercept (container) ->
            if not container then cb error 404, 'runnable not found' else
              add = () ->
                channels.findOne aliases:text.toLowerCase(), domain.intercept (channel) ->
                  createTag = (channel, cb) ->
                    container.tags.push channel:channel._id
                    container.save domain.intercept () ->
                      newTag = (_.last container.tags).toJSON();
                      newTag.name = channel.name
                      cb null, newTag
                  if channel then createTag channel, cb else
                    channels.createImplicitChannel domain, text, (err, channel) ->
                      if err then cb err else createTag channel, cb
              if container.owner.toString() is userId.toString() then add() else
                if user.permission_level > 1 then add() else
                  cb error 403, 'permission denied'

  removeContainerTag: (domain, userId, runnableId, tagId, cb) ->
    runnableId = decodeId runnableId
    containers.findOne _id: runnableId, domain.intercept (container) ->
      if not container then cb error 404, 'runnable not found' else
        if container.owner.toString() isnt userId.toString()
          users.findOne _id: userId, domain.intercept (user) ->
            if not user then cb error 403, 'user not found' else
              if user.permission_level < 2 then cb error 403, 'permission denied' else
                container.tags.id(tagId).remove()
                container.save domain.intercept () ->
                  cb()
        else
          container.tags.id(tagId).remove()
          container.save domain.intercept () ->
            cb()

  searchImages: (domain, searchText, limit, cb) ->
    images.search domain, searchText, limit, (err, results) ->
      if err then cb err else
        arrayToJSON domain, results, cb

  syncFiles: (domain, userId, runnableId, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.syncFiles domain, cb

  listFiles: (domain, userId, runnableId, content, dir, default_tag, path, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.listFiles domain, content, dir, default_tag, path, cb

  createFile: (domain, userId, runnableId, name, path, content, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.createFile domain, name, path, content, (err, file) ->
          cb err, file

  readFile: (domain, userId, runnableId, fileId, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.readFile domain, fileId, cb

  updateFile: (domain, userId, runnableId, fileId, content, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.updateFile domain, fileId, content, cb

  updateFileContents: (domain, userId, runnableId, fileId, content, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.updateFileContents domain, fileId, content, cb

  deleteFile: (domain, userId, runnableId, fileId, recursive, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.deleteFile domain, fileId, recursive, cb

  renameFile: (domain, userId, runnableId, fileId, name, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.renameFile domain, fileId, name, cb

  moveFile: (domain, userId, runnableId, fileId, path, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.moveFile domain, fileId, path, cb

  createDirectory: (domain, userId, runnableId, name, path, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.createDirectory domain, name, path, cb

  defaultFile: (domain, userId, runnableId, fileId, isDefault, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.tagFile domain, fileId, isDefault, cb

  getMountedFiles: (domain, userId, runnableId, fileId, mountDir, cb) ->
    fetchContainer domain, userId, runnableId, (err, container) ->
      if err then cb err else
        container.getMountedFiles domain, fileId, mountDir, cb

  getStat: (domain, userId, runnableId, stat, cb) ->
    if not (stat in stats) then cb error 400, 'not a valid stat' else
      runnableId = decodeId runnableId
      async.parallel [
        (cb) ->
          images.findOne _id: runnableId, domain.intercept (image) ->
            cb null, image[stat]
        (cb) ->
          users.findOne _id: userId, domain.intercept (user) ->
            cb null, user[stat]
      ], (err, results) ->
        if err then cb err else
          cb null,
            image: results[0]
            user: results[1]

  incrementStat: (domain, userId, runnableId, stat, cb) ->
    if !(stat in stats) then cb error 400, 'not a valid stat' else
      runnableId = decodeId runnableId
      update = $inc:{}
      update.$inc[stat] = 1
      async.parallel [
        (cb) ->
          images.findOneAndUpdate _id: runnableId, update, domain.intercept (image) ->
            cb null, image
        (cb) ->
          users.findOneAndUpdate _id: userId, update, domain.intercept (user) ->
            cb null, user
      ], (err, results) ->
        if err then cb err else
          encode domain, results[0].toJSON(), cb


module.exports = Runnables

fetchContainer = (domain, userId, runnableId, cb) ->
  runnableId = decodeId runnableId
  containers.findOne _id: runnableId, domain.intercept (container) ->
    if not container then cb error 404, 'runnable not found' else
      if container.owner.toString() isnt userId.toString() then cb error 403, 'permission denied' else
        cb null, container

arrayToJSON = (domain, res, cb) ->
  async.map res, (item, cb) ->
    json = if item.toJSON then item.toJSON() else item
    encode domain, json, cb
  , cb

plus = /\+/g
slash = /\//g
minus = /-/g
underscore = /_/g

stats = [
  'copies'
  'pastes'
  'cuts'
  'runs'
  'views'
]

encode = (domain, json, cb) ->
  json._id = encodeId json._id
  if json.files? then delete json.files
  if json.parent? then json.parent = encodeId json.parent
  if json.target? then json.target = encodeId json.target
  if json.child? then json.child = encodeId json.child
  json.tags = json.tags or []
  async.forEach json.tags, (tag, cb) ->
    channels.findOne _id: tag.channel, domain.intercept (channel) ->
      if channel then tag.name = channel.name
      cb()
  , (err) ->
    cb err, json

encodeId = (id) -> id
decodeId = (id) -> id

if configs.shortProjectIds
  encodeId = (id) -> (new Buffer(id.toString(), 'hex')).toString('base64').replace(plus,'-').replace(slash,'_')
  decodeId = (id) -> (new Buffer(id.toString().replace(minus,'+').replace(underscore,'/'), 'base64')).toString('hex');

isObjectId = (str) ->
  Boolean(str.match(/^[0-9a-fA-F]{24}$/))

isObjectId64 = (str) ->
  str = decodeId str
  Boolean(str.match(/^[0-9a-fA-F]{24}$/))

exists = (thing) ->
  thing isnt null and thing isnt undefined

updateCmd = (domain, container, cb) ->
  startCommandArray = (container.start_cmd || "date").split " "
  url = "http://#{container.servicesToken}.#{configs.rootDomain}/api/cmd"
  request.post
    url: url
    pool: false
    json:
      cmd: startCommandArray.shift()
      args: startCommandArray
  , domain.intercept cb
