var express = require('express');
var app = module.exports = express();
var me = require('middleware/me');
var users = require('middleware/users');
var tokens = require('middleware/tokens');
var query = require('middleware/query');
var body = require('middleware/body');
var params = require('middleware/params');
var utils = require('middleware/utils');
var or = utils.or;
var series = utils.series;
var ternary = utils.ternary;

app.use('/me/votes', require('./votes'));

app.post('/',
  me.create(),
  tokens.createToken,
  me.model.save(),
  me.respond);

app.all('*', tokens.hasToken);

app.get('/',
  query.pickAndRequireOne('_id', 'channel', 'username'),
  query.ifExists('_id',
    or(query.isObjectId('_id'), query.isObjectIdArray('_id')),
    query.castAsMongoQuery(),
    users.publicFind('query'),
    users.respond),
  query.ifExists('username',
    users.publicFind('query'),
    users.respond));

var updateUser = series(
  params.replaceMeWithMyId('userId'),
  or(me.isUser, me.isModerator),
  body.pickAndRequireOne(
    'name',
    'company',
    'show_email',
    'initial_referrer',
    'email', 'username', 'password'),
  body.ifOneExists(['passwordNew'],
    me.changepass,
    me.respond),
  body.ifOneExists(['email', 'username', 'password'],
    me.register,
    me.respond),
  users.findByIdAndUpdate('params.userId', 'body'),
  users.respond);


app.get('/:userId/sendVerificationMail',
   params.replaceMeWithMyId('userId'),
   or(me.isUser, me.isModerator),
   me.resendVerificationEmail,
   utils.message('Verification Mail Sent.')
  );

app.post('/verify',
  params.replaceMeWithMyId('userId'),
  body.pickAndRequire(
    'username', 'verification_token'),
  me.verify('body'),
  utils.message('Email verified.')
  );

app.post('/changepass',
  params.replaceMeWithMyId('userId'),
  // body.pickAndRequire('passwordNew'),
  me.changepass,
  utils.message('Password Changed')
  );

// app.post('/changemailreq', changeMailReq);

app.post('/changemailreq',
  params.replaceMeWithMyId('userId'),
  // body.pickAndRequire('passwordNew'),
  me.changeMailReq,
  utils.message('Email change Req Placed')
 );

app.post('/changemail',
  params.replaceMeWithMyId('userId'),
  body.pickAndRequire(
    'username', 'email_change_token'),
  me.changeMail('body'),
  utils.message('Email Changed.')
  );

app.post('/passResetReq',
  me.passResetReq('body'),
  utils.message('Password reset mail sent.')
  );

app.post('/setpass',
  params.replaceMeWithMyId('userId'),
  body.pickAndRequire(
    'username', 'new_pass', 'pass_reset_token'),
  me.setpass('body'),
  utils.message('Password reset successfull.')
  );

app.post('/validateToken',
  body.pickAndRequire(
    'username', 'token', 'token_type'),
  me.validateToken('body'),
  utils.message('Valid Token.')
  );

// app.get('/passReset/:userId',
//   params.replaceMeWithMyId('userId'),
//   ternary(or(me.isUser, me.isModerator),
//     users.findById('params.userId'),
//     users.publicFindById('params.userId')),
//   users.respond
//   )

app.get('/:userId',
  params.replaceMeWithMyId('userId'),
  ternary(or(me.isUser, me.isModerator),
    users.findById('params.userId'),
    users.publicFindById('params.userId')),
  users.respond);

app.del('/:userId',
  params.replaceMeWithMyId('userId'),
  or(me.isUser, me.isModerator),
  users.remove({ _id: 'params.userId' }),
  utils.message('user deleted'));

app.put('/:userId', updateUser);

app.patch('/:userId', updateUser);