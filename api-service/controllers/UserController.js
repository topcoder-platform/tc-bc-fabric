/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file is the controller for user APIs.
 * @author TCSDEVELOPER
 * @version 1.0
 */

const service = require('../services/UserService');

/**
 * Creates a user.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function create(req, res) {
  res.json(await service.create(req.body));
}

/**
 * list users.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function list(req, res) {
  res.json(await service.list());
}

/**
 * Logins a user.
 * @param req the request.
 * @param res the response
 * @returns {Promise<void>}
 */
async function login(req, res) {
  res.json(await service.login(req.body));
}

module.exports = {
  create,
  list,
  login
};