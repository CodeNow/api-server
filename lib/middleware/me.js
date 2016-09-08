var bcrypt = require('bcrypt');
var configs = require('configs');
var User = require('models/users');
var containers = require('./containers');
var body = require('./body');
var params = require('./params');
var createMongooseMiddleware = require('./createMongooseMiddleware');
var error = require('error');
var utils = require('./utils');
var series = utils.series;
var reqUnlessExists = utils.reqUnlessExists;

var emailer = require('../emailer');

var me = module.exports = createMongooseMiddleware(User, {
  findMe: function (req, res, next) {
    if (!req.user_id) {
      throw new Error('NO USER_ID');
    }
    series(
      this.findById('user_id'),
      this.checkFound
    )(req, res, next);
  },
  isUser: function (req, res, next) {
    series(
      params.replaceMeWithMyId('userId'),
      checkUserIdsMatch
    )(req, res, next);
    function checkUserIdsMatch() {
      if (!utils.equalObjectIds(req.user_id, req.params.userId)) {
        return next(error(403, 'access denied (!user)'));
      }
      next();
    }
  },
  isOwnerOf: function (key) {
    return series(
      reqUnlessExists('me',
        this.findMe),
      isOwner);
    function isOwner (req, res, next) {
      var model = req[key];
      if (!model || !req.me.isOwnerOf(model)){
        return next(error(403, 'access denied (!owner)'));
      }
      next();
    }
  },
  isRegistered: function (req, res, next) {
    this.permission('registered')(req, res, next);
  },
  isVerified: function (req, res, next) {
    this.permission('isVerified')(req, res, next);
  },
  isModerator: function (req, res, next) {
    this.permission('isModerator')(req, res, next);
  },
  isAdmin: function (req, res, next) {
    this.permission('isAdmin')(req, res, next);
  },
  permission: function (attr) {
    return series(
      reqUnlessExists('me',
        this.findMe),
      this.model.unless(attr,
        utils.error(403, 'access denied (!'+attr+')'))
    );
  },
  respond: function (req, res, next) {
    var model = req.me;
    series(
      addExtra,
      this.super.respond
    )(req, res, next);
    function addExtra (req, res, next) {
      if (!model.get('gravitar')) {
        model.set('gravitar', model.toJSON()._gravitar, { strict: false });
      }
      if (req.me && req.access_token) {
        if (req.me.toJSON) {
          req.me = req.me.toJSON();
        }
        req.me.access_token = req.access_token;
      }
      next();
    }
  },
  register: function (req, res, next) {
    series(
      body.require('email', 'username', 'password'),
      this.findConflictEmailOrUsername,
      body.pick('email', 'username', 'password'),
      registeredFields,
      this.findMe,
      this.model.set('body'),
      this.sendVerficationEmail,
      this.model.save()
    )(req, res, next);
    function registeredFields (req, res, next) {
      bcrypt.hash(req.body.password + configs.passwordSalt, 10,
        req.domain.intercept(function (hashedPassword) {
          req.body.password = hashedPassword;
          req.body.permission_level = 1;
          req.body.verification_token = require('crypto').randomBytes(48).toString('hex');
          req.body.signup_ip = req.headers['x-real-ip'];
          next();
        }));
    }
  },
  changepass: function (req, res, next) {
    series(
      body.require('password', 'passwordNew'),
      body.pick('password', 'passwordNew'),
      this.findMe,
      this.checkUserPassword('me', 'body.password'),
      registeredFields,
      body.pick('password'),
      this.model.set('body'),
      this.model.save()
    )(req, res, next);
    function registeredFields (req, res, next) {
      bcrypt.hash(req.body.passwordNew + configs.passwordSalt, 10,
        req.domain.intercept(function (hashedPassword) {
          req.body.password = hashedPassword;
          next();
        }));
    }
  },
  changeMailReq: function (req, res, next) {
    series(
      body.require('email_new'),
      body.pick('email_new'),
      this.findMe,
      registeredFields,
      this.model.set('body'),
      this.model.save(),
      this.sendMailChgVerification
    )(req, res, next);
    function registeredFields (req, res, next) {      
      req.body.email_change_token = require('crypto').randomBytes(48).toString('hex');
      req.body.email_change_token_created = Date();
      next();
    }
  },
  verify: function (verificationData) {
    return series(
      body.require('username', 'verification_token'),
      body.pick('username', 'verification_token'),
      this.findOne({
        username: 'body.username',
        verification_token: 'body.verification_token'
      }),
      this.checkFound,
      this.model.set('permission_level', 2, { strict: false }),
      this.model.save()
    );
  },
  changeMail: function (verificationData) {
    return series(
      body.pickAndRequire('username', 'email_change_token'),
      this.findOne({
        username: 'body.username',
        email_change_token: 'body.email_change_token'
      }),
      this.checkFound,
      updateNewMail,
      this.model.setAndSave('body')
    );
    function updateNewMail (req, res, next) {      
      req.body.email = req.me.email_new;
      req.body.email_new = undefined;
      req.body.email_change_token = undefined;
      req.body.email_change_token_created = undefined;
      next();
    }
  },
  resendVerificationEmail: function (req, res, next) {
    series(
      regenerateToken,
      this.findMe,
      this.checkFound,
      this.model.setAndSave('verification_token', require('crypto').randomBytes(48).toString('hex')),
      this.sendVerficationEmail
    )(req, res, next);

    function regenerateToken(req, res, next) {
      req.body.verification_token = require('crypto').randomBytes(48).toString('hex');
      next();
    }
  },
  sendVerficationEmail: function (req, res, next) {
    emailer.sendVerificationMail(req.me, next);
  },
  sendMailChgVerification: function (req, res, next) {
    emailer.sendMailChgVerification(req.me, next);
  },
  findConflictEmailOrUsername: function (req, res, next) {
    var query = { // used users here so not override the session user
      $or: [
        { email: req.body.email },
        { lower_username: req.body.username.toLowerCase() }
      ]
    };
    User.findOne(query, { _id:1, email:1, lower_username:1 }, req.domain.intercept(function (user) {
      if (user) {
        if (utils.equalObjectIds(user._id, req.user_id)) {
          next(400, 'already registered');
        }
        else {
          var field = (user.email === req.body.email) ? 'email' : 'username';
          next(error(409, 'user with '+field+' already exists'));
        }
      }
      else {
        next();
      }
    }));
  },
  passResetReq: function (userData) {
    return series(
      body.requireOne('username', 'email'),
      body.pick('username', 'email'),
      this.findOne({
        $or: [
          { email: 'body.email' },
          { username: 'body.username' },
          { username: 'body.email' }
        ]
      }),
      this.checkFound,
      genPassReset,
      body.pick('pass_reset_token', 'pass_reset_token_created'),
      this.model.set('body'),
      this.model.save(),
      this.sendPassResetMail
    );
    function genPassReset (req, res, next) {      
      req.body.pass_reset_token = require('crypto').randomBytes(48).toString('hex');
      req.body.pass_reset_token_created = Date();
      next();
    }
  },
  sendPassResetMail: function (req, res, next) {
    emailer.sendPassResetMail(req.me, next);
  },
  setpass: function (verificationData) {
    return series(
      body.pickAndRequire('username', 'new_pass', 'pass_reset_token'),
      this.findOne({
        username: 'body.username',
        pass_reset_token: 'body.pass_reset_token'
      }),
      this.checkFound,
      updateNewPass,
      body.pick('password', 'pass_reset_token'),
      this.model.setAndSave('body')
    );
    function updateNewPass (req, res, next) {      
      bcrypt.hash(req.body.new_pass + configs.passwordSalt, 10,
        req.domain.intercept(function (hashedPassword) {
          req.body.password = hashedPassword;
          req.body.pass_reset_token = undefined;
          next();
        })
      );
    }
  },
  validateToken: function(validationData) {
    return series(
      body.require('username', 'token', 'token_type'),
      body.pick('username', 'token', 'token_type'),
      this.findOne({
        username: 'body.username',
        pass_reset_token: 'body.token'
      }),
      this.checkFound
    );
  },
  login: function (loginData) {
    return series(
      body.requireOne('username', 'email'),
      body.require('password'),
      body.pick('username', 'email', 'password'),
      this.findOne({
        $or: [
          { email: 'body.email' },
          { username: 'body.username' },
          { username: 'body.email' }
        ]
      }),
      this.checkFound,
      this.checkUserPassword('me', 'body.password'),
      this.model.setAndSave('last_login', Date()),
      containers.authChangeUpdateOwners);
  },
  checkUserPassword: function (userKey, passwordKey) {
    return function (req, res, next) {
      var user = utils.replacePlaceholders(req, userKey);
      var password = utils.replacePlaceholders(req, passwordKey);
      user.checkPassword(password, req.domain.intercept(function (matches) {
        if (!matches) {
          return next(error(403, 'invalid password'));
        }
        next();
      }));
    };
  }
}, 'me');