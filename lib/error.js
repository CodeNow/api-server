var _ = require('lodash');
module.exports = function error (code, msg) {
  if (typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg);
    }
    catch (circularErr) {
      msg = _.mapValues(function (val) {
        return (typeof val === 'object') ? null : val; // remove subobjects
      });
      return error(code, msg);
    }
  }
  var e = new Error(msg);
  e.msg = msg;
  e.code = code;
  return e;
};