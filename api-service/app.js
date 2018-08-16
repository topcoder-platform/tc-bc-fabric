/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

const Path = require('path');
const config = require('config');
const _ = require('lodash');
const createError = require('http-errors');
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const Joi = require('joi');

const helper = require('./utils/helper');

const app = express();
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


// register the joi
Joi.id = () => Joi.string().required();
Joi.emailId = () => Joi.string().email().required();
Joi.optionalId = () => Joi.string();
Joi.roles = () => Joi.string().valid('manager', 'reviewer', 'copilot', 'member', 'client');

const addRoutes = () => {
  _.each(require('./routes'), (verbs, path) => {
    _.each(verbs, (def, verb) => {
      const controllerPath = Path.join(__dirname, `./controllers/${def.controller}`);
      const method = require(controllerPath)[def.method];
      if (!method) {
        throw new Error(`${def.method} is undefined`);
      }
      const actions = [];
      actions.push((req, res, next) => {
        req.signature = `${def.controller}#${def.method}`;
        next();
      });

      actions.push(method);

      app[verb](`/api/${config.version}${path}`, helper.autoWrapExpress(actions));
    });
  });
};

addRoutes();

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  const payload = {
    status: err.httpStatus || err.status || 500,
    message: err.message
  };
  // render the error page
  res.status(payload.status);
  res.json(payload);
});

module.exports = app;
