/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */


/**
 * This file performs the authorization.
 */

const _ = require('lodash');
const helper = require('./helper');
const fabricService = require('../services/FabricService');
const userService = require('../services/UserService');

/**
 * Reads the token from header.
 * @param req the request.
 * @returns {*} the token.
 */
const readToken = (req) => {
  if (!req.headers || !req.headers.authorization) {
    return null;
  }
  const t = req.headers.authorization.indexOf('Bearer ');
  if (t < 0) {
    return null;
  }
  return req.headers.authorization.substring(t + 'Bearer '.length);
};


/**
 * The controller middleware.
 * @param roles the roles
 * @returns {Function} the middlewar.
 */
const middleware = (roles) => {
  return async (req, res, next) => {
    const jwtToken = readToken(req);
    if (!jwtToken) {
      const err = new Error('Authentication is required');
      err.status = 401;
      return next(err);
    }

    try {
      const decoded = await helper.verifyJWTToken(jwtToken);
      if (!decoded.user || !decoded.user.id) {
        const err = new Error('Invalid jwt token');
        err.status = 401;
        return next(err);
      }
      // get the user by userId
      const user = await userService.getById(decoded.user.id);
      if (!user) {
        const err = new Error('Invalid jwt token. cannot find the user');
        err.status = 401;
        return next(err);
      }
      // check the roles
      const permittedRoles = _.intersection(roles, user.roles);
      if(permittedRoles.length === 0) {
        const err = new Error(
          `Permission denied. Only the user of roles: ${JSON.stringify(roles)} can do the operation`);
        err.status = 403;
        return next(err);
      }
      user.permittedRoles = permittedRoles;
      req.user = user;
      next();
    } catch (e) {
      next(e);
    }
  };
};




module.exports = {
  middleware
};