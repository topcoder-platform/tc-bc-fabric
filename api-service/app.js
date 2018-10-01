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
Joi.operator = () => Joi.object().keys({
  memberId: Joi.id(),
  memberEmail: Joi.emailId(),
  roles: Joi.array().items(Joi.roles()).required(),
  permittedRoles: Joi.array().items(Joi.roles()).required()
});




const addRoutes = () => {
  const auth = require('./utils/auth');
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

      if (def.auth) {
        // check the auth
        actions.push(auth.middleware(def.auth));
      }

      // handler the multipart upload
      if (method.uploader) {
        actions.push(method.uploader);
      }

      actions.push(method);

      app[verb](`/api/${config.version}${path}`, helper.autoWrapExpress(actions));
    });
  });
};

addRoutes();

// register the hook when challenge is completed
app.on('ChallengeCompleted', (challenge) => {
  console.log('Challenge : ' + challenge.challengeId + ' is completed. Here are the details: ');
  console.log('Winners And prizes: ', JSON.stringify(challenge.winners.map(
    w => {return {memberId: w.memberId, prize: w.prize}})));
});

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

// set up the update job
setInterval(async () => {
  const phaseUpdater = require('./jobs/phaseUpdater');
  try {
    await phaseUpdater(app);
  } catch (e) {
    console.error(e);
  }

}, config.phaseCheckInterval * 1000);

module.exports = app;
