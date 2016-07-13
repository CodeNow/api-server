var _ = require('lodash');
var async = require('async');
var configs = require('./configs');
var User = require('models/users');
var nodemailer = require('nodemailer');
var sgTransport = require('nodemailer-sendgrid-transport');

exports.sendDelistEmail = function(userId, image, cb) {
  async.waterfall([
    User.findById.bind(User, userId),
    sendDelistEmailToUser
  ], cb);
  var self = this;
  function sendDelistEmailToUser (user, cb) {
    var email = delistEmail(user, image);
    self.sendEmailToUser(user, email.subject, email.body, cb);
  }
};

exports.sendEmailToUser = function (user, subject, body, cb) {
  var opts = {
    to: user.email,
    subject: subject,
    text: body
  };
  this.sendEmail(opts, cb);
};

exports.sendVerificationMail = function (user, cb) {
  userVerificationLink = 'http://' + configs.domain + '/u/verify/' + user.username + '/' + user.verification_token;
  var opts = {
    to: user.email,
    subject: 'Activate you brand new account at code.runnable.com',
    html: '<p>Please verify your account by clicking <a href="' + userVerificationLink + '">' + userVerificationLink + '</a> </p> <p>If you are unable to do so, copy and paste the link into your browser.</p>',
    text: 'Please verify your account by clicking the following link, or by copying and pasting it into your browser: ' + userVerificationLink
  };
  this.sendEmail(opts, cb);
};

exports.sendEmail = function (opts, cb) {
  
  if (!configs.sendGrid.sendMail) {
    console.log('Info: Sendgrid Email send log (no config set):', opts.to, opts.subject);
    return cb();
  }
  _.extend(opts, {
    from   : configs.sendGrid.from,
    replyTo: configs.sendGrid.replyTo,
  });

  // check if we are on staging, and send the email to us rather than the user
  var env = process.env.NODE_ENV || 'dev';
  if (env !== 'production' && configs.sendGrid.to) {
    opts.to = configs.sendGrid.to;
  }
  // only on production, bcc the moderators
  // (don't need otherwise since we overwrite `to` above)
  if (env === 'production' && configs.sendGrid.moderators) {
    opts.bcc = configs.sendGrid.moderators;
  }
  var options = {
      auth: {
          api_key: configs.sendGrid.auth.api_key
      }
  }

  var mailer = nodemailer.createTransport(sgTransport(options));
  mailer.sendMail(opts, function(err, response) {
      if (err) { 
          cb(new Error('Email failed to send (sendGrid): '+ err.message));
      }
      console.log(response);
      cb();
  });

};

// Templates
//

function delistEmail (user, image) {
  var subject = 'Code Example Delisted from Runnable';
  var body =
    ['Hi ' + user.username + ',\n',
    ['Your code example "' + image.name + '"',
     '(http://' + configs.domain + '/' + image.appUrl + ')',
     'has been flagged and delisted from',
     'Runnable for one of the following reasons:\n'].join(' '),
    '  - Title doesn\'t adequately describe the example',
    '  - Code example does not Run',
    '  - Code example is a duplicate of an existing code example',
    '  - Code example is abusive of the Runnable Infrastructure',
    '  - Code example is offensive to the Runnable community\n',
    ['To allow others to find your code on Runnable again, please update it to',
     'address the reasons stated above and re-add the relevant tags. You can',
     'reply to this email if you have any questions or would like to know the',
     'specific reason for delisting your code example.\n'].join(' '),
    'Thanks,',
    'The Runnable Team'].join('\n');
  return {
    subject: subject,
    body: body
  };
}
