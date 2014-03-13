var utils = require('middleware/utils');

module.exports = {
  validateInputs: function (req, res, next) {
    var URL = req.quary.url;
    // validate link to ensure we support it
    if (!URL) {
      next(new Error("no URL provided"));
      return;
    }
    if (this.isUrlSupported(URL)) {
      next(new Error("no URL provided"));
      return;
    }
    console.log("URL validated");
    next();
  // ensure link exist
  },
  isUrlSupported: function (URL) {
    // put all supported regex here
    
    var supportedUrl = [
      { name: "git",
        pat: /.git$/
      },
      { name: "zip",
        pat: /.zip$/
      },
    ];
    for (var i = 0; i < supportedUrl.length; i++) {
      var result = URL.match(supportedUrl[i].pat);
      if (result) {
        return true;
      }
    }
    return false;
  }
};