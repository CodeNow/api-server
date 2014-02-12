var _ = require('lodash');
module.exports = function error (code, msg) {
  if (typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg);
    }
    catch (circularErr) {
      msg = _.mapValues(function (val) {
      // keep only strings/numbers, remove sub objs to prevent circular
        return (typeof val === 'string' || typeof val === 'number') ? val : null;
      });
      return error(code, msg);
    }
  }
  var e = new Error(msg);
  e.msg = msg;
  e.code = code;
  return e;
};