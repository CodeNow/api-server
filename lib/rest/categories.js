// Generated by CoffeeScript 1.6.3
(function() {
  var categories, configs, domains, error, express;

  configs = require('../configs');

  categories = require('../models/categories');

  domains = require('../domains');

  error = require('../error');

  express = require('express');

  module.exports = function(parentDomain) {
    var app;
    app = module.exports = express();
    app.use(domains(parentDomain));
    app.post('/categories', function(req, res) {
      return categories.createCategory(req.domain, req.user_id, req.body.name, req.body.description, function(err, category) {
        if (err) {
          return res.json(err.code, {
            message: err.msg
          });
        } else {
          return res.json(201, category);
        }
      });
    });
    app.get('/categories', function(req, res) {
      if (req.query.name != null) {
        return categories.getCategoryByName(req.domain, req.query.name, function(err, category) {
          if (err) {
            return res.json(err.code, {
              message: err.msg
            });
          } else {
            return res.json([category]);
          }
        });
      } else {
        return categories.listCategories(req.domain, function(err, categories) {
          if (err) {
            return res.json(err.code, {
              message: err.msg
            });
          } else {
            return res.json(categories);
          }
        });
      }
    });
    app.get('/categories/:id', function(req, res) {
      return categories.getCategory(req.domain, req.params.id, function(err, category) {
        if (err) {
          return res.json(err.code, {
            message: err.msg
          });
        } else {
          return res.json(category);
        }
      });
    });
    app.put('/categories/:id', function(req, res) {
      return categories.updateCategory(req.domain, req.user_id, req.params.id, req.body.name, req.body.description, function(err, category) {
        if (err) {
          return res.json(err.code, {
            message: err.msg
          });
        } else {
          return res.json(category);
        }
      });
    });
    app.del('/categories/:id', function(req, res) {
      return categories.deleteCategory(req.domain, req.user_id, req.params.id, function(err) {
        if (err) {
          return res.json(err.code, {
            message: err.msg
          });
        } else {
          return res.json({
            message: 'category deleted'
          });
        }
      });
    });
    app.put('/categories/:id/aliases', function(req, res) {
      return categories.updateAliases(req.domain, req.user_id, req.params.id, req.body, function(err, category) {
        if (err) {
          return res.json(err.code, {
            message: err.msg
          });
        } else {
          return res.json(category.aliases);
        }
      });
    });
    return app;
  };

}).call(this);

/*
//@ sourceMappingURL=categories.map
*/