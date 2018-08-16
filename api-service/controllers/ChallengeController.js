/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file is the controller for challenge APIs.
 * @author TCSDEVELOPER
 * @version 1.0
 */

const service = require('../services/ChallengeService');

/**
 * Creates a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function create(req, res) {
  res.json(await service.create(req.body));
}

/**
 * Updates a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function update(req, res) {
  res.json(await service.update(req.params.challengeId, req.body));
}

/**
 * Registers a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function registerChallenge(req, res) {
  res.json(await service.registerChallenge(req.body));
}

/**
 * Unregisters a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function unregisterChallenge(req, res) {
  res.json(await service.unregisterChallenge(req.body));
}


module.exports = {
  create,
  update,
  registerChallenge,
  unregisterChallenge
};