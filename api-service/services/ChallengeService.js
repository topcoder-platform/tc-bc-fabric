/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This is the file for challenge service.
 *
 * @author TCSDEVELOPER
 * @version 1.0
 */
const Joi = require('joi');
const logger = require('../utils/logger');
const userService = require('./UserService');
const fabricService = require('./FabricService');

/**
 * Creates the challenge.
 * @param payload the challenge payload.
 * @returns {Promise<*>} the result.
 */
async function create(payload) {
  const client = await userService.validateUserAndEnroll(payload.createdBy, ['copilot', 'manager']);
  await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'projects', 'createChallenge', [JSON.stringify(payload)], false);
  return payload;
}

/**
 * The validate schema for create.
 */
create.schema = {
  payload: Joi.object().keys({
    challengeId: Joi.id(),
    projectId: Joi.id(),
    name: Joi.string().required(),
    description: Joi.string(),
    createdBy: Joi.emailId()
  })
};

/**
 * Updates a challenge.
 * @param challengeId the challenge id.
 * @param payload the payload.
 * @returns {Promise<*>} the result.
 */
async function update(challengeId, payload) {
  const client = await userService.validateUserAndEnroll(payload.updatedBy, ['copilot', 'manager']);
  await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'projects', 'updateChallenge', [JSON.stringify(payload)], false);
  return payload;
}

/**
 * The schema for update.
 */
update.schema = {
  challengeId: Joi.id(),
  payload: Joi.object().keys({
    challengeId: Joi.id(),
    name: Joi.string(),
    description: Joi.string(),
    updatedBy: Joi.emailId()
  })
};

/**
 * Registers a challenge.
 * @param member the member.
 * @returns {Promise<void>} the result.
 */
async function registerChallenge(member) {
  const client = await userService.validateUserAndEnrollById(member.memberId, ['member']);
  await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'projects', 'registerChallenge', [JSON.stringify(member)], false);
}

/**
 * The schema for register.
 */
registerChallenge.schema = {
  member: Joi.object().keys({
    memberId: Joi.id(),
    challengeId: Joi.id(),
    projectId: Joi.id()
  })
};

/**
 * Unregister a challenge
 * @param member the member.
 * @returns {Promise<void>} the result.
 */
async function unregisterChallenge(member) {
  const client = await userService.validateUserAndEnrollById(member.memberId, ['member']);
  await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'projects', 'unregisterChallenge', [JSON.stringify(member)], false);
}

unregisterChallenge.schema = registerChallenge.schema;

module.exports = {
  create,
  update,
  registerChallenge,
  unregisterChallenge
};

logger.buildService(module.exports);