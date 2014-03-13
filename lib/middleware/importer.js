var request = require('request');

var supportedUrl = [
  { name: "git",
    pat: /.git$/
  },
  { name: "zip",
    pat: /.zip$/
  },
];

var validateInputs = function (req, res, next) {
  validateUrl(req, res, next);
};

var validateUrl = function (req, res, next) {
  var url = req.query.url;
  // validate link to ensure we support it
  if (!url) {
    next(new Error("no url provided"));
    return;
  }
  if (!isUrlSupported(url)) {
    next(new Error("url not supported"));
    return;
  }
  doesUrlExist(url, function(err) {
    if (err) {
      next(new Error("url does not exist"));
    } else {
      next();
    }
  });
};

var isUrlSupported = function (url) {
  // put all supported regex here
  for (var i = 0; i < supportedUrl.length; i++) {
    var result = url.match(supportedUrl[i].pat);
    if (result) {
      return true;
    }
  }
  return false;
};

var getUrlType = function (url) {
  // put all supported regex here
  for (var i = 0; i < supportedUrl.length; i++) {
    var result = url.match(supportedUrl[i].pat);
    if (result) {
      return supportedUrl[i].name;
    }
  }
  return null;
};

var doesUrlExist = function(url, cb) {
    request.get(url, function (err, res, body) {
      if (err) {
        cb(err);
      } else if (res.statusCode !== 200) {
        cb(new Error(body && body.message));
      } else {
        cb();
      }
    });
  };

module.exports.validateInputs = validateInputs;