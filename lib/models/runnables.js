var ObjectId, Runnables, arrayToJSON, async, caching, channels, configs, containers, decodeId, domain, encode, encodeId, encodeIdsIn, error, exists, fetchContainer, harbourmaster, images, implementations, isObjectId, isObjectId64, listFields, minus, plus, request, slash, stats, underscore, updateCmd, users, _, __indexOf = [].indexOf || function (item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (i in this && this[i] === item) {
        return i;
      }
    }
    return -1;
  };
async = require('async');
caching = require('./caching');
channels = require('./channels');
configs = require('../configs');
containers = require('./containers');
domain = require('domain');
error = require('../error');
images = require('./images');
users = require('./users');
implementations = require('./implementations');
harbourmaster = require('./harbourmaster');
_ = require('lodash');
ObjectId = require('mongoose').Types.ObjectId;
request = require('request');
listFields = {
  _id: 1,
  name: 1,
  tags: 1,
  owner: 1,
  created: 1,
  votes: 1,
  views: 1,
  copies: 1,
  runs: 1
};
Runnables = {
  createImageFromDisk: function (domain, userId, runnablePath, sync, cb) {
    return images.createFromDisk(domain, userId, runnablePath, sync, function (err, image, tags) {
      if (err) {
        return cb(err);
      } else {
        return async.forEach(tags, function (tag, cb) {
          return channels.findOne({ aliases: tag.toLowerCase() }, domain.intercept(function (channel) {
            if (channel) {
              image.tags.push({ channel: channel._id });
              return cb();
            } else {
              return channels.createImplicitChannel(domain, tag, function (err, channel) {
                if (err) {
                  return cb(err);
                } else {
                  image.tags.push({ channel: channel._id });
                  return cb();
                }
              });
            }
          }));
        }, function (err) {
          if (err) {
            throw err;
          }
          return image.save(domain.intercept(function () {
            return users.findUser(domain, { _id: userId }, function (err, user) {
              if (err) {
                return cb(err);
              } else {
                if (!user) {
                  return cb(error(404, 'user not found'));
                } else {
                  return user.addVote(domain, image._id, function (err) {
                    var json_image;
                    if (err) {
                      return cb(err);
                    } else {
                      json_image = image.toJSON();
                      delete json_image.files;
                      if (json_image.parent) {
                        json_image.parent = encodeId(json_image.parent);
                      }
                      json_image._id = encodeId(image._id);
                      cb(null, json_image);
                      return caching.markCacheAsDirty();
                    }
                  });
                }
              }
            });
          }));
        });
      }
    });
  },
  createImage: function (domain, userId, from, sync, cb) {
    if (!isObjectId64(from)) {
      return cb(error(404, 'source runnable not found'));
    } else {
      return containers.findOne({ _id: decodeId(from) }, domain.intercept(function (container) {
        if (!container) {
          return cb(error(403, 'source runnable not found'));
        } else {
          if (container.owner.toString() !== userId) {
            return cb(error(403, 'permission denied'));
          } else {
            return images.createFromContainer(domain, container, function (err, image) {
              if (err) {
                return cb(err);
              } else {
                container.target = image._id;
                return container.save(domain.intercept(function () {
                  return users.findUser(domain, { _id: userId }, function (err, user) {
                    if (err) {
                      return cb(err);
                    } else {
                      if (!user) {
                        return cb(error(404, 'user not found'));
                      } else {
                        return user.addVote(domain, image._id, function (err) {
                          var json_image;
                          if (err) {
                            return cb(err);
                          } else {
                            json_image = image.toJSON();
                            delete json_image.files;
                            if (json_image.parent) {
                              json_image.parent = encodeId(json_image.parent);
                            }
                            json_image._id = encodeId(image._id);
                            cb(null, json_image);
                            return caching.markCacheAsDirty();
                          }
                        });
                      }
                    }
                  });
                }));
              }
            });
          }
        }
      }));
    }
  },
  createContainer: function (domain, userId, from, cb) {
    var data;
    data = {};
    return async.waterfall([
      function (cb) {
        var options;
        if (isObjectId64(from)) {
          return images.findOne({ _id: decodeId(from) }, domain.intercept(function (image) {
            if (!image) {
              return cb(error(400, 'could not find source image to fork from'));
            } else {
              return cb(null, image);
            }
          }));
        } else {
          options = {
            sort: { _id: 1 },
            limit: 1
          };
          return channels.findOne({ aliases: from.toLowerCase() }, domain.intercept(function (channel) {
            var useOldestProject;
            if (!channel) {
              return cb(error(400, 'could not find channel by that name'));
            } else {
              useOldestProject = function () {
                return images.find({ 'tags.channel': channel._id }, null, options, domain.intercept(function (images) {
                  if (!images.length) {
                    return cb(error(400, 'could not find runnable to fork from'));
                  } else {
                    return cb(null, images[0]);
                  }
                }));
              };
              return users.findOne({ _id: userId }, { permission_level: 1 }, domain.intercept(function (user) {
                if (user.registered) {
                  data.saved = true;
                }
                if (!channel.base) {
                  return useOldestProject();
                } else {
                  return images.findById(channel.base, domain.intercept(function (image) {
                    if (!image) {
                      return useOldestProject();
                    } else {
                      return cb(null, image);
                    }
                  }));
                }
              }));
            }
          }));
        }
      },
      function (image, cb) {
        return containers.create(domain, userId, image, data, function (err, container) {
          var json_container;
          if (err) {
            return cb(err);
          } else {
            json_container = container.toJSON();
            return encode(domain, json_container, cb);
          }
        });
      }
    ], cb);
  },
  listContainers: function (domain, userId, query, cb) {
    query = query || {};
    query.owner = userId;
    return containers.find(query, domain.intercept(function (containers) {
      return async.map(containers, function (item, cb) {
        var json;
        json = item.toJSON();
        return encode(domain, json, cb);
      }, cb);
    }));
  },
  migrateContainers: function (domain, userId, targetUserId, cb) {
    return containers.update({ owner: userId }, { $set: { owner: targetUserId } }, domain.intercept(function () {
      return cb();
    }));
  },
  getContainer: function (domain, userId, runnableId, cb) {
    runnableId = decodeId(runnableId);
    if (!isObjectId(runnableId)) {
      return cb(error, 404, 'runnable not found');
    } else {
      return containers.findOne({ _id: runnableId }, domain.intercept(function (container) {
        var json;
        if (!container) {
          return cb(error(404, 'runnable not found'));
        } else if (container.owner.toString() !== userId.toString()) {
          return cb(error(403, 'permission denied'));
        } else {
          json = container.toJSON();
          return encode(domain, json, cb);
        }
      }));
    }
  },
  removeContainer: function (domain, userId, runnableId, cb) {
    var remove;
    runnableId = decodeId(runnableId);
    remove = function () {
      return containers.destroy(domain, runnableId, cb);
    };
    return containers.findOne({ _id: runnableId }, domain.intercept(function (container) {
      if (!container) {
        return cb(error(404, 'runnable not found'));
      } else {
        if (container.owner.toString() === userId.toString()) {
          return remove();
        } else {
          return users.findUser(domain, { _id: userId }, function (err, user) {
            if (err) {
              return cb(err);
            } else {
              if (!user) {
                return cb(error(404, 'user not found'));
              } else {
                if (user.permission_level <= 1) {
                  return cb(error(403, 'permission denied'));
                } else {
                  return remove();
                }
              }
            }
          });
        }
      }
    }));
  },
  removeImage: function (domain, userId, runnableId, cb) {
    runnableId = decodeId(runnableId);
    var remove = function () {
      images.destroy(domain, runnableId, cb);
    };
    images.findOne({ _id: runnableId }, domain.intercept(function (image) {
      if (!image) {
        cb(error(404, 'runnable not found'));
      } else if (image.owner.toString() === userId.toString()) {
        remove();
      } else {
        users.findUser(domain, { _id: userId }, domain.intercept(function (user) {
          if (!user) {
            cb(error(404, 'user not found'));
          } else if (user.permission_level <= 1) {
            cb(error(403, 'permission denied'));
          } else {
            var _ref = user.votes;
            for (var _i = 0, _len = _ref.length; _i < _len; _i++) {
              var vote = _ref[_i];
              if (vote.runnable.toString() === image._id.toString()) {
                vote.remove();
              }
            }
            remove();
          }
        }));
      }
    }));
  },
  updateContainer: function (domain, userId, runnableId, updateSet, token, cb) {
    var commit;
    runnableId = decodeId(runnableId);
    commit = function (container, cb) {
      var json;
      json = encodeIdsIn(container.toJSON());
      return harbourmaster.commitContainer(domain, json, token, cb);
    };
    return containers.findOne({ _id: runnableId }, { files: 0 }, domain.intercept(function (container) {
      if (container == null) {
        return cb(error(404, 'runnable not found'));
      } else {
        container.set(updateSet);
        return async.series([
          function (cb) {
            if (updateSet.status === 'Committing new') {
              return images.findOne({ name: updateSet.name || container.name }, domain.intercept(function (existing) {
                if (existing) {
                  return cb(error(403, 'a shared runnable by that name already exists'));
                } else {
                  return commit(container, cb);
                }
              }));
            } else if (updateSet.status === 'Committing back') {
              return commit(container, cb);
            } else {
              return cb();
            }
          },
          function (cb) {
            return container.updateRunOptions(domain, cb);
          },
          function (cb) {
            return container.save(domain.intercept(function () {
              return cb();
            }));
          }
        ], function (err) {
          if (err) {
            return cb(err);
          } else {
            return encode(domain, container.toJSON(), cb);
          }
        });
      }
    }));
  },
  updateImage: function (domain, userId, runnableId, from, cb) {
    runnableId = decodeId(runnableId);
    from = decodeId(from);
    return images.findOne({ _id: runnableId }, domain.intercept(function (image) {
      var update;
      if (!image) {
        return cb(error(404, 'published runnable does not exist'));
      } else {
        update = function (su) {
          return containers.findOne({ _id: from }, domain.intercept(function (container) {
            if (!container) {
              return cb(error(403, 'source container to copy from does not exist'));
            } else {
              if (!su && container.owner.toString() !== image.owner.toString()) {
                return cb(error(400, 'source container owner does not match image owner'));
              } else {
                return image.updateFromContainer(domain, container, function (err) {
                  if (err) {
                    return cb(err);
                  } else {
                    return encode(domain, image.toJSON(), cb);
                  }
                });
              }
            }
          }));
        };
        if (image.owner.toString() === userId) {
          return update(false);
        } else {
          return users.findUser(domain, { _id: userId }, function (err, user) {
            if (err) {
              return cb(err);
            } else {
              if (!user) {
                return cb(error(404, 'user not found'));
              } else {
                if (user.permission_level < 5) {
                  return cb(error(403, 'permission denied'));
                } else {
                  return update(true);
                }
              }
            }
          });
        }
      }
    }));
  },
  getImage: function (domain, runnableId, cb) {
    var decodedRunnableId;
    if (!isObjectId64(runnableId)) {
      return cb(error(404, 'runnable not found'));
    } else {
      decodedRunnableId = decodeId(runnableId);
      return images.findOne({ _id: decodedRunnableId }, { files: 0 }, domain.intercept(function (image) {
        var json_project;
        if (!image) {
          return cb(error(404, 'runnable not found'));
        } else {
          json_project = image.toJSON();
          return encode(domain, json_project, cb);
        }
      }));
    }
  },
  getVotes: function (domain, runnableId, cb) {
    runnableId = decodeId(runnableId);
    return users.find({ 'votes.runnable': runnableId }).count().exec(domain.intercept(function (count) {
      return cb(null, { count: count - 1 });
    }));
  },
  vote: function (domain, userId, runnableId, cb) {
    runnableId = decodeId(runnableId);
    return async.series([
      function (cb) {
        return images.isOwner(domain, userId, runnableId, domain.intercept(function (isOwner) {
          if (isOwner) {
            return cb(error(403, 'cannot vote for own runnables'));
          } else {
            return cb();
          }
        }));
      },
      function (cb) {
        return users.addVote(domain, userId, runnableId, cb);
      },
      function (cb) {
        return images.incVote(domain, runnableId, cb);
      }
    ], function (err, results) {
      var vote;
      if (err != null) {
        return cb(err);
      } else {
        vote = results[1];
        return cb(null, vote);
      }
    });
  },
  listAll: function (domain, sort, limit, page, cb) {
    var countQuery, query;
    query = images.find({}, listFields).sort(sort).skip(page * limit).limit(limit);
    countQuery = images.find({}, listFields).sort(sort).skip(page * limit).limit(limit).count();
    return async.parallel({
      images: function (cb) {
        return query.exec(domain.intercept(function (images) {
          return arrayToJSON(domain, images, cb);
        }));
      },
      count: function (cb) {
        return countQuery.exec(domain.intercept(function (count) {
          return cb(null, count);
        }));
      }
    }, function (err, results) {
      var lastPage;
      if (err) {
        return cb(err);
      } else {
        lastPage = Math.ceil(results.count / limit) - 1;
        return cb(null, results.images, { lastPage: lastPage });
      }
    });
  },
  listByPublished: function (domain, sort, limit, page, cb) {
    return this.listFiltered(domain, { tags: { $not: { $size: 0 } } }, sort, limit, page, null, cb);
  },
  listByChannelMembership: function (domain, channelIds, sort, limit, page, cb) {
    return this.listFiltered(domain, { 'tags.channel': { $in: channelIds } }, sort, limit, page, null, cb);
  },
  listByOwner: function (domain, owner, sort, limit, page, cb) {
    var fields;
    fields = _.clone(listFields);
    _.extend(fields, {
      copies: 1,
      pastes: 1,
      cuts: 1,
      runs: 1,
      views: 1
    });
    return this.listFiltered(domain, { owner: owner }, sort, limit, page, fields, cb);
  },
  listFiltered: function (domain, query, sort, limit, page, fields, cb) {
    var countQuery;
    fields = fields || listFields;
    countQuery = images.find(query, fields).sort(sort).skip(page * limit).limit(limit).count();
    query = images.find(query, fields).sort(sort).skip(page * limit).limit(limit).lean();
    return async.parallel({
      images: function (cb) {
        return query.exec(domain.intercept(function (images) {
          return arrayToJSON(domain, images, cb);
        }));
      },
      count: function (cb) {
        return countQuery.exec(domain.intercept(function (count) {
          return cb(null, count);
        }));
      }
    }, function (err, results) {
      var lastPage;
      if (err) {
        return cb(err);
      } else {
        lastPage = Math.ceil(results.count / limit) - 1;
        return cb(null, results.images, { lastPage: lastPage });
      }
    });
  },
  listNames: function (domain, cb) {
    return images.find({ tags: { $not: { $size: 0 } } }, {
      _id: 1,
      name: 1,
      tags: 1
    }).exec(domain.intercept(function (results) {
      return arrayToJSON(domain, results, cb);
    }));
  },
  getTags: function (domain, runnableId, cb) {
    runnableId = decodeId(runnableId);
    return images.findOne({ _id: runnableId }, domain.intercept(function (image) {
      if (!image) {
        return cb(error(404, 'runnable not found'));
      } else {
        return async.map(image.tags, function (tag, cb) {
          var json;
          json = tag.toJSON();
          return channels.findOne({ _id: json.channel }, domain.intercept(function (channel) {
            if (channel) {
              json.name = channel.name;
            }
            return cb(null, json);
          }));
        }, cb);
      }
    }));
  },
  getTag: function (domain, runnableId, tagId, cb) {
    runnableId = decodeId(runnableId);
    return images.findOne({ _id: runnableId }, domain.intercept(function (image) {
      var json, tag;
      if (!image) {
        return cb(error(404, 'runnable not found'));
      } else {
        tag = image.tags.id(tagId);
        if (!tag) {
          return cb(error(404, 'tag not found'));
        } else {
          json = tag.toJSON();
          return channels.findOne({ _id: json.channel }, domain.intercept(function (channel) {
            if (channel) {
              json.name = channel.name;
            }
            return cb(null, json);
          }));
        }
      }
    }));
  },
  addTag: function (domain, userId, runnableId, text, cb) {
    return users.findUser(domain, { _id: userId }, function (err, user) {
      if (err) {
        return cb(err);
      } else {
        if (!user) {
          return cb(error(403, 'user not found'));
        } else {
          if (user.permission_level < 1) {
            return cb(error(403, 'permission denied'));
          } else {
            runnableId = decodeId(runnableId);
            return images.findOne({ _id: runnableId }, domain.intercept(function (image) {
              var add;
              if (!image) {
                return cb(error(404, 'runnable not found'));
              } else {
                add = function () {
                  return channels.findOne({ aliases: text.toLowerCase() }, domain.intercept(function (channel) {
                    var createTag;
                    createTag = function (channel, cb) {
                      image.tags.push({ channel: channel._id });
                      return image.save(domain.intercept(function () {
                        var newTag;
                        newTag = _.last(image.tags).toJSON();
                        newTag.name = channel.name;
                        return cb(null, newTag);
                      }));
                    };
                    if (channel) {
                      return createTag(channel, cb);
                    } else {
                      return channels.createImplicitChannel(domain, text, function (err, channel) {
                        if (err) {
                          return cb(err);
                        } else {
                          return createTag(channel, cb);
                        }
                      });
                    }
                  }));
                };
                if (image.owner.toString() === userId.toString()) {
                  return add();
                } else {
                  if (user.permission_level > 1) {
                    return add();
                  } else {
                    return cb(error(403, 'permission denied'));
                  }
                }
              }
            }));
          }
        }
      }
    });
  },
  removeTag: function (domain, userId, runnableId, tagId, cb) {
    runnableId = decodeId(runnableId);
    return images.findOne({ _id: runnableId }, domain.intercept(function (image) {
      if (!image) {
        return cb(error(404, 'runnable not found'));
      } else {
        if (image.owner.toString() !== userId.toString()) {
          return users.findOne({ _id: userId }, domain.intercept(function (user) {
            if (!user) {
              return cb(error(403, 'user not found'));
            } else {
              if (user.permission_level < 2) {
                return cb(error(403, 'permission denied'));
              } else {
                image.tags.id(tagId).remove();
                return image.save(domain.intercept(function () {
                  return cb();
                }));
              }
            }
          }));
        } else {
          image.tags.id(tagId).remove();
          return image.save(domain.intercept(function () {
            return cb();
          }));
        }
      }
    }));
  },
  getContainerTags: function (domain, runnableId, cb) {
    runnableId = decodeId(runnableId);
    return containers.findOne({ _id: runnableId }, domain.intercept(function (container) {
      if (!container) {
        return cb(error(404, 'runnable not found'));
      } else {
        return async.map(container.tags, function (tag, cb) {
          var json;
          json = tag.toJSON();
          return channels.findOne({ _id: json.channel }, domain.intercept(function (channel) {
            if (channel) {
              json.name = channel.name;
            }
            return cb(null, json);
          }));
        }, cb);
      }
    }));
  },
  getContainerTag: function (domain, runnableId, tagId, cb) {
    runnableId = decodeId(runnableId);
    return containers.findOne({ _id: runnableId }, domain.intercept(function (container) {
      var json, tag;
      if (!container) {
        return cb(error(404, 'runnable not found'));
      } else {
        tag = container.tags.id(tagId);
        if (!tag) {
          return cb(error(404, 'tag not found'));
        } else {
          json = tag.toJSON();
          return channels.findOne({ _id: json.channel }, domain.intercept(function (channel) {
            if (channel) {
              json.name = channel.name;
            }
            return cb(null, json);
          }));
        }
      }
    }));
  },
  addContainerTag: function (domain, userId, runnableId, text, cb) {
    return users.findUser(domain, { _id: userId }, function (err, user) {
      if (err) {
        return cb(err);
      } else {
        if (!user) {
          return cb(error(403, 'user not found'));
        } else {
          runnableId = decodeId(runnableId);
          return containers.findOne({ _id: runnableId }, domain.intercept(function (container) {
            var add;
            if (!container) {
              return cb(error(404, 'runnable not found'));
            } else {
              add = function () {
                return channels.findOne({ aliases: text.toLowerCase() }, domain.intercept(function (channel) {
                  var createTag;
                  createTag = function (channel, cb) {
                    container.tags.push({ channel: channel._id });
                    return container.save(domain.intercept(function () {
                      var newTag;
                      newTag = _.last(container.tags).toJSON();
                      newTag.name = channel.name;
                      return cb(null, newTag);
                    }));
                  };
                  if (channel) {
                    return createTag(channel, cb);
                  } else {
                    return channels.createImplicitChannel(domain, text, function (err, channel) {
                      if (err) {
                        return cb(err);
                      } else {
                        return createTag(channel, cb);
                      }
                    });
                  }
                }));
              };
              if (container.owner.toString() === userId.toString()) {
                return add();
              } else {
                if (user.permission_level > 1) {
                  return add();
                } else {
                  return cb(error(403, 'permission denied'));
                }
              }
            }
          }));
        }
      }
    });
  },
  removeContainerTag: function (domain, userId, runnableId, tagId, cb) {
    runnableId = decodeId(runnableId);
    return containers.findOne({ _id: runnableId }, domain.intercept(function (container) {
      if (!container) {
        return cb(error(404, 'runnable not found'));
      } else {
        if (container.owner.toString() !== userId.toString()) {
          return users.findOne({ _id: userId }, domain.intercept(function (user) {
            if (!user) {
              return cb(error(403, 'user not found'));
            } else {
              if (user.permission_level < 2) {
                return cb(error(403, 'permission denied'));
              } else {
                container.tags.id(tagId).remove();
                return container.save(domain.intercept(function () {
                  return cb();
                }));
              }
            }
          }));
        } else {
          container.tags.id(tagId).remove();
          return container.save(domain.intercept(function () {
            return cb();
          }));
        }
      }
    }));
  },
  searchImages: function (domain, searchText, limit, cb) {
    return images.search(domain, searchText, limit, function (err, results) {
      if (err) {
        return cb(err);
      } else {
        return arrayToJSON(domain, results, cb);
      }
    });
  },
  syncFiles: function (domain, userId, runnableId, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.syncFiles(domain, cb);
      }
    });
  },
  listFiles: function (domain, userId, runnableId, content, dir, default_tag, path, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.listFiles(domain, content, dir, default_tag, path, cb);
      }
    });
  },
  createFile: function (domain, userId, runnableId, name, path, content, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.createFile(domain, name, path, content, function (err, file) {
          return cb(err, file);
        });
      }
    });
  },
  readFile: function (domain, userId, runnableId, fileId, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.readFile(domain, fileId, cb);
      }
    });
  },
  updateFile: function (domain, userId, runnableId, fileId, content, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.updateFile(domain, fileId, content, cb);
      }
    });
  },
  updateFileContents: function (domain, userId, runnableId, fileId, content, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.updateFileContents(domain, fileId, content, cb);
      }
    });
  },
  deleteFile: function (domain, userId, runnableId, fileId, recursive, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.deleteFile(domain, fileId, recursive, cb);
      }
    });
  },
  renameFile: function (domain, userId, runnableId, fileId, name, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.renameFile(domain, fileId, name, cb);
      }
    });
  },
  moveFile: function (domain, userId, runnableId, fileId, path, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.moveFile(domain, fileId, path, cb);
      }
    });
  },
  createDirectory: function (domain, userId, runnableId, name, path, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.createDirectory(domain, name, path, cb);
      }
    });
  },
  defaultFile: function (domain, userId, runnableId, fileId, isDefault, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.tagFile(domain, fileId, isDefault, cb);
      }
    });
  },
  getMountedFiles: function (domain, userId, runnableId, fileId, mountDir, cb) {
    return fetchContainer(domain, userId, runnableId, function (err, container) {
      if (err) {
        return cb(err);
      } else {
        return container.getMountedFiles(domain, fileId, mountDir, cb);
      }
    });
  },
  getStat: function (domain, userId, runnableId, stat, cb) {
    if (__indexOf.call(stats, stat) < 0) {
      return cb(error(400, 'not a valid stat'));
    } else {
      runnableId = decodeId(runnableId);
      return async.parallel([
        function (cb) {
          return images.findOne({ _id: runnableId }, domain.intercept(function (image) {
            return cb(null, image[stat]);
          }));
        },
        function (cb) {
          return users.findOne({ _id: userId }, domain.intercept(function (user) {
            return cb(null, user[stat]);
          }));
        }
      ], function (err, results) {
        if (err) {
          return cb(err);
        } else {
          return cb(null, {
            image: results[0],
            user: results[1]
          });
        }
      });
    }
  },
  incrementStat: function (domain, userId, runnableId, stat, cb) {
    var update;
    if (__indexOf.call(stats, stat) < 0) {
      return cb(error(400, 'not a valid stat'));
    } else {
      runnableId = decodeId(runnableId);
      update = { $inc: {} };
      update.$inc[stat] = 1;
      return async.parallel([
        function (cb) {
          return images.findOneAndUpdate({ _id: runnableId }, update, domain.intercept(function (image) {
            return cb(null, image);
          }));
        },
        function (cb) {
          return users.findOneAndUpdate({ _id: userId }, update, domain.intercept(function (user) {
            return cb(null, user);
          }));
        }
      ], function (err, results) {
        if (err) {
          return cb(err);
        } else {
          return encode(domain, results[0].toJSON(), cb);
        }
      });
    }
  }
};
module.exports = Runnables;
fetchContainer = function (domain, userId, runnableId, cb) {
  runnableId = decodeId(runnableId);
  return containers.findOne({ _id: runnableId }, domain.intercept(function (container) {
    if (!container) {
      return cb(error(404, 'runnable not found'));
    } else {
      if (container.owner.toString() !== userId.toString()) {
        return cb(error(403, 'permission denied'));
      } else {
        return cb(null, container);
      }
    }
  }));
};
arrayToJSON = function (domain, res, cb) {
  return async.map(res, function (item, cb) {
    var json;
    json = item.toJSON ? item.toJSON() : item;
    return encode(domain, json, cb);
  }, cb);
};
plus = /\+/g;
slash = /\//g;
minus = /-/g;
underscore = /_/g;
stats = [
  'copies',
  'pastes',
  'cuts',
  'runs',
  'views'
];
encode = function (domain, json, cb) {
  if (json.files != null) {
    delete json.files;
  }
  json = encodeIdsIn(json);
  json.tags = json.tags || [];
  return async.forEach(json.tags, function (tag, cb) {
    return channels.findOne({ _id: tag.channel }, domain.intercept(function (channel) {
      if (channel) {
        tag.name = channel.name;
      }
      return cb();
    }));
  }, function (err) {
    return cb(err, json);
  });
};
encodeIdsIn = function (json) {
  json._id = encodeId(json._id);
  if (json.parent != null) {
    json.parent = encodeId(json.parent);
  }
  if (json.target != null) {
    json.target = encodeId(json.target);
  }
  if (json.child != null) {
    json.child = encodeId(json.child);
  }
  return json;
};
encodeId = function (id) {
  return id;
};
decodeId = function (id) {
  return id;
};
if (configs.shortProjectIds) {
  encodeId = function (id) {
    return new Buffer(id.toString(), 'hex').toString('base64').replace(plus, '-').replace(slash, '_');
  };
  decodeId = function (id) {
    return new Buffer(id.toString().replace(minus, '+').replace(underscore, '/'), 'base64').toString('hex');
  };
}
isObjectId = function (str) {
  return Boolean(str.match(/^[0-9a-fA-F]{24}$/));
};
isObjectId64 = function (str) {
  str = decodeId(str);
  return Boolean(str.match(/^[0-9a-fA-F]{24}$/));
};
exists = function (thing) {
  return thing !== null && thing !== void 0;
};
updateCmd = function (domain, container, cb) {
  var startCommandArray, url;
  startCommandArray = (container.start_cmd || 'date').split(' ');
  url = 'http://' + container.servicesToken + '.' + configs.rootDomain + '/api/cmd';
  return request.post({
    url: url,
    pool: false,
    json: {
      cmd: startCommandArray.shift(),
      args: startCommandArray
    }
  }, domain.intercept(cb));
};