var domain = require('domain');
var dockerExp = /^HTTP response code is (\d\d\d) which indicates an error: (.+)$/;
module.exports = function (req, res, next) {
  var d = domain.create();
  req.domain = d;
  d.add(req);
  d.add(res);
  d.on('error', onError);
  d.run(next);
  function onError (e) {
    var knownError =
      e.isResponseError ||
      typeof e.code === 'number' ||
      e.name === 'MongoError' ||
      e.name === 'ValidationError';

    if (knownError) {
      next(e);
    } else {
      res.json(500, {
        message: 'something bad happened :('
      });
      throw e;
    }
  }
};
