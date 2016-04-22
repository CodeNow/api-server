var express = require('express');
var error = require('error');
var configs = require('configs');
// var tokens = require('middleware/tokens');
var utils = require('middleware/utils');
var app = module.exports = express();

var cors = require('cors');
var corsOptions = {
  origin: 'http://swagger.apyl:8080'
};
app.use(cors(corsOptions));

app.use(require('domains'));
if (configs.logExpress) {
  app.use(express.logger());
  app.use(function (req, res, next) {
    console.log(req.method, req.url);
    next();
  });
}
app.use(require('connect-datadog')({
  'response_code':true,
  'method':true,
  'tags': ['serverType:api', 'logType:express']
}));
app.use(express.json());
app.use(express.urlencoded());
// app.use('/token', require('./rest/tokens'));
app.use('/users', require('./rest/users'));
// app.use(tokens.hasToken);
app.use('/runnables', require('./rest/images'));
app.use('/images', require('./rest/images'));
app.use('/feeds/images', require('./rest/feeds/images'));
app.use(require('./rest/containers')('/users/:userId/runnables'));
app.use('/channels', require('./rest/channels'));
app.use('/users/me/implementations', require('./rest/implementations'));
app.use('/specifications', require('./rest/specifications'));
app.use(require('./rest/categories'));
app.use(require('./rest/campaigns'));
app.use('/cleanup', require('./rest/cleanup'));
app.use(require('./rest/emails'));
app.use(app.router);
app.use(errorCaster); // must be above nodetime and rollbar!
app.use(mongooseErrorHandler);
app.use(sendIf400Error);
if (configs.rollbar) {
  app.use(require('rollbar').errorHandler());
}
app.get('/', function (req, res) {
  res.json({ message: 'runnable api' });
});
app.all('*', function (req, res) {
  console.error("ERROR app.all 404");
  res.json(404, { message: 'resource not found' });
});
app.use(errorMiddleware);


function sendIf400Error (err, req, res, next) {
  // only 401s and 404s for now bc they are spammy
  // continue to track 404s on container pages for analytics purposes
  var isContainerPage = (req.url.indexOf('/users/me/runnables/') === 0);
  if (err.code === 401 ||  (err.code === 404 && !isContainerPage)) {
    if(err.code !== 404) {
      console.error("ERROR sendIf400Error", err, err.stack, res.code, req.url);
    } else {
      console.error("ERROR sendIf400Error", err, res.code, req.url);
    }
    res.json(err.code, {
      message: err.msg,
      stack: configs.throwErrors ?
        err.stack : undefined
    });
  }
  else {
    next(err);
  }
}

function mongooseErrorHandler (err, req, res, next) {
  if (err.name === 'MongoError') {
    if (err.code === 11000) {
      var resourceAliases = {
        image: 'runnable',
        container: 'draft',
        me: 'user'
      };
      var fieldAliases = {
        aliases: 'name',
        lower: 'username'
      };
      var match = /([^.]+).\$([^_]+)_/.exec(err.err);
      var resource = utils.singularize(match[1]);
      resource = resourceAliases[resource] || resource;
      var field = fieldAliases[match[2]] || match[2];
      var message = resource + ' with ' + field + ' already exists';
      err = error(409, message);
    }
  }
  next(err);
}

function errorCaster (err, req, res, next) {
  if (err instanceof Error) {
    next(err);
  }
  else {
    try {
      err = new Error(JSON.stringify(err));
    }
    catch (stringifyErr) {
      err = new Error(err+'');
    }
    next(err);
  }
}

function errorMiddleware (err, req, res, next) {
  if(err.code !== 404) {
    console.error("ERROR errorMiddleware", err, err.stack, res.code, req.url);
  }
  if (err.isResponseError) {
    res.json(err.code || 500, {
      message: err.msg,
      data: err.data,
      stack: configs.throwErrors ? err.stack : undefined
    });
  } else {
    res.json(500, {
      message: 'something bad happened :(',
      stack: err.stack
    });
  }
}
