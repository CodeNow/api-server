var configs = require('./configs');
var nodemailer = require('nodemailer');
var rollbar = require('rollbar');
if (configs.rollbar) {
  rollbar.init(configs.rollbar.key, configs.rollbar.options);
}

exports.delistEmail = function(user, container) {
  var body = ['Hi ' + user.username + ',\n',
    'Your code example "' + container.name + '" (http://runnable.com/' + encodeId(container._id) + '/' + container.name + ') has been flagged and delisted from Runnable for one of the following reasons:\n',
    '  - Title doesn\'t adequately describe the example',
    '  - Code example does not Run',
    '  - Code example is a duplicate of an existing code example',
    '  - Code example is abusive of the Runnable Infrastructure',
    '  - Code example is offensive to the Runnable community\n',
    'To allow others to find your code on Runnable again, please update it to address the reasons stated above and re-add the relevant tags. You can reply to this email if you have any questions or would like to know the specific reason for delisting your Code Example.\n',
    'Thanks,',
    'The Runnable Team'].join('\n');

  if (!configs.SES.sendMail) {
    rollbar.reportMessageWithPayloadData('Info: Delist Email would be sent',
      { level: 'info', 'email': body });
    return;
  }
  
  var mailOptions = {
    from: configs.SES.from,
    replyTo: configs.SES.replyTo,
    to: user.email,
    subject: '[test] Code Example Delisted from Runnable',
    text: body
  };

  var transport = nodemailer.createTransport('SMTP', {
    service: 'SES',
    auth: {
      user: configs.SES.auth.username,
      pass: configs.SES.auth.pass
    }
  });

  transport.sendMail(mailOptions, function(error, response) {
    if (error) {
      rollbar.reportMessage('Delist Email failed to send (SES)', 'error');
    }
    transport.close();
  });
};

var plus = /\+/g;
var slash = /\//g;
var minus = /-/g;
var encodeId = function (id) {
  return id;
};
var decodeId = function (id) {
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
