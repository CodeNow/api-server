module.exports = function error (code, msg) {
  var e = new Error(msg);
  e.msg = msg;
  e.code = code;
  e.stack = (new Error()).stack;
  return e;
};