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
  res.json(await service.create(req.user, req.body));
}

/**
 * Updates a project.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function update(req, res) {
  res.json(await service.update(req.user, req.params.projectId, req.body));
}

/**
 * Gets a project.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function get(req, res) {
  let channel = req.query.channel;
  if (!channel) {
    if (req.user.permittedRoles.indexOf('manager') >= 0) {
      channel = 'topcoder-review';
    } else {
      channel = 'topcoder-client';
    }
  }

  res.json(await service.get(req.user, req.params.projectId, channel));
}

/**
 * list projects.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function list(req, res) {
  let channel = req.query.channel;
  if (!channel) {
    if (req.user.permittedRoles.indexOf('manager') >= 0) {
      channel = 'topcoder-review';
    } else {
      channel = 'topcoder-client';
    }
  }
  res.json(await service.list(req.user, channel));
}

module.exports = {
  create,
  update,
  get,
  list
};