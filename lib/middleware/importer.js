var supportedUrl = [
  { name: "git",
    pat: /.git$/
  },
  { name: "zip",
    pat: /.zip$/
  },
];

var validateInputs = function (req, res, next) {
  var URL = req.query.url;
  // validate link to ensure we support it
  if (!URL) {
    next(new Error("no URL provided"));
    return;
  }
  if (!isUrlSupported(URL)) {
    next(new Error("URL not supported"));
    return;
  }
  console.log("URL validated");
  next();
// ensure link exist
};

var isUrlSupported = function (URL) {
  // put all supported regex here
  console.log("url: "+URL);
  for (var i = 0; i < supportedUrl.length; i++) {
    var result = URL.match(supportedUrl[i].pat);
    if (result) {
      return true;
    }
  }
  return false;
};

module.exports.validateInputs = validateInputs;
module.exports.isUrlSupported = isUrlSupported;