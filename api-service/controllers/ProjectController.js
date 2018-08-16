/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file is the controller for project APIs.
 * @author TCSDEVELOPER
 * @version 1.0
 */

const service = require('../services/ProjectService');

/**
 * Creates a project.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function create(req, res) {
  res.json(await service.create(req.body));
}

/**
 * Updates a project.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function update(req, res) {
  res.json(await service.update(req.params.projectId, req.body));
}

/**
 * Gets a project.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function get(req, res) {
  res.json(await service.get(req.params.projectId));
}

/**
 * list projects.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function list(req, res) {
  res.json(await service.list(req.query.channel || 'topcoder-review'));
}

module.exports = {
  create,
  update,
  get,
  list
};