/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This is the file for project service.
 *
 * @author TCSDEVELOPER
 * @version 1.0
 */
const Joi = require('joi');
const _ = require('lodash');
const errors = require('../utils/errors');
const logger = require('../utils/logger');
const userService = require('./UserService');
const fabricService = require('./FabricService');

/**
 * Checks if the copilot id is a real copilot or not.
 * @param copilotId the copilot id.
 * @returns {Promise<void>} the result, if not copilot, throws exception.
 */
async function validateCopilot(copilotId) {
  const user = await userService.getById(copilotId);
  if (!user) {
    throw new errors.ValidationError('cannot find user of the copilot with id: ' + copilotId);
  }
  if (!user.roles || user.roles.indexOf('copilot') < 0) {
    throw new errors.ValidationError('User with id: ' + copilotId + ' is not a copilot');
  }
}

/**
 * Creates a project.
 * @param operator the user doing the current operation.
 * @param payload the payload.
 * @returns {Promise<*>} the result.
 */
async function create(operator, payload) {
  payload.status = 'draft';

  if (payload.copilotId) {
    await validateCopilot(payload.copilotId);
  }

  // validate the clientId is a client
  const clientUser = await userService.getById(payload.clientId);
  if (!clientUser) {
    throw new errors.ValidationError('cannot find user of the client with id: ' + payload.clientId);
  }
  if (!clientUser.roles || clientUser.roles.indexOf('client') < 0) {
    throw new errors.ValidationError('User with id: ' + copilotId + ' is not a client');
  }

  const projectId = payload.projectId;

  payload.createdBy = operator.memberId;

  const client = await userService.enrollUser(operator, operator.permittedRoles);

  const eProject = await fabricService.queryByChaincode(client, client.getChannel('topcoder-client'),
    'topcoder-client', 'getProject', [projectId], false);

  if (eProject) {
    throw new errors.ConflictError(`project ${projectId} already exists.`);
  }

  payload.clientTransactionId = await fabricService.invokeChainCode(client,
    client.getChannel('topcoder-client'), 'topcoder-client', 'createProject', [JSON.stringify(payload)], false);

  return payload;
}

/**
 * The schema for create.
 */
create.schema = {
  operator: Joi.operator().required(),
  payload: Joi.object().keys({
    projectId: Joi.id(),
    clientId: Joi.id(),
    copilotId: Joi.optionalId(),
    name: Joi.string().required(),
    description: Joi.string(),
    budget: Joi.number().min(0).required(),
    status: Joi.string().valid('active', 'draft')
  }).required()
};

/**
 * Updates a project.
 * @param operator the current operator
 * @param projectId the id of the project.
 * @param payload the payload.
 * @returns {Promise<*>} the result.
 */
async function update(operator, projectId, payload) {

  if (payload.copilotId) {
    await validateCopilot(payload.copilotId);
  }

  let reviewTransactionId = null;
  let clientTransactionId = null;

  payload.updatedBy = operator.memberId;

  const client = await userService.enrollUser(operator, operator.permittedRoles);

  const eProject = await fabricService.queryByChaincode(client, client.getChannel('topcoder-client'),
    'topcoder-client', 'getProject', [projectId], false);

  if (eProject === null) {
    throw new errors.NotFoundError('cannot find project with id: ' + projectId);
  }

  const isManager = client.appUser.roles.indexOf('manager') >= 0;
  if ((eProject.status !== 'draft' || payload.status === 'draft') && !isManager) {
    throw new errors.ForbiddenError('only Topcoder manager can update a non-draft project');
  }

  if (eProject.status !== 'draft' && payload.status === 'draft') {
    throw new errors.BadRequestError('cannot rollback the project to draft');
  }

  // update the project in topcoder-client channel
  clientTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-client'),
    'topcoder-client', 'updateProject', [JSON.stringify(payload)], false);


  if (eProject.status === 'draft' && payload.status && payload.status !== 'draft') {
    const updatedProject = await fabricService.queryByChaincode(client, client.getChannel('topcoder-client'),
      'topcoder-client', 'getProject', [projectId], false);
    const topcoderReviewPayload = _.extend({}, updatedProject);
    delete topcoderReviewPayload.budget;
    delete topcoderReviewPayload.clientId;
    // copy and create this project in topcoder-review channel
    reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'), 'topcoder-review', 'createProject',
      [JSON.stringify(topcoderReviewPayload)], false);

  } else if (eProject.status !== 'draft') {
    const topcoderReviewPayload = _.extend({}, payload);
    delete topcoderReviewPayload.budget;
    delete topcoderReviewPayload.clientId;
    // update the project in topcoder-review channel
    reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'), 'topcoder-review', 'updateProject',
      [JSON.stringify(topcoderReviewPayload)], false);
  }

  // return the result from the topcoder-client channel
  const result = await fabricService.queryByChaincode(client, client.getChannel('topcoder-client'),
    'topcoder-client', 'getProject', [projectId], false);
  result.clientTransactionId = clientTransactionId;
  if (reviewTransactionId) {
    result.reviewTransactionId = reviewTransactionId;
  }
  return result;
}

/**
 * The schema for update.
 */
update.schema = {
  operator: Joi.operator().required(),
  projectId: Joi.id(),
  payload: Joi.object().keys({
    projectId: Joi.id(),
    copilotId: Joi.optionalId(),
    name: Joi.string(),
    description: Joi.string(),
    budget: Joi.number().min(0),
    status: Joi.string().valid('draft', 'active')
  })
};

/**
 * Gets the project by id.
 * @param operator the operator
 * @param projectId the id of the project.
 * @param channelName the channel name.
 * @returns {Promise<*>} the result.
 */
async function get(operator, projectId, channelName) {
  if (channelName === 'topcoder-review' && operator.permittedRoles.indexOf('manager') < 0) {
    throw new errors.ForbiddenError('A client cannot access the topcoder-review channel data.');
  }

  if (channelName === 'topcoder-review') {
    operator.permittedRoles = ['manager'];
  }

  let chaincodeName = null;
  if (channelName === 'topcoder-review') {
    chaincodeName = 'topcoder-review';
  } else {
    chaincodeName = 'topcoder-client';
  }
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  const project = await fabricService.queryByChaincode(client, client.getChannel(channelName),
    chaincodeName, 'getProject', [projectId], false);
  if (!project) {
    throw new errors.BadRequestError('cannot find thie project with id: ' + projectId);
  }
  return project;
}

/**
 * The schema for get.
 */
get.schema = {
  operator: Joi.operator().required(),
  projectId: Joi.id(),
  channelName: Joi.string().valid('topcoder-client', 'topcoder-review').required()
};

/**
 * Lists the projects of a channel.
 * @param operator, the current operator
 * @param channelName the name of the channel.
 * @returns {Promise<*>} the result.
 */
async function list(operator, channelName) {
  if (channelName === 'topcoder-review' && operator.permittedRoles.indexOf('manager') < 0) {
     throw new errors.ForbiddenError('A client cannot access the topcoder-review channel data.');
  }
  if (channelName === 'topcoder-review') {
    operator.permittedRoles = ['manager'];
  }
  let chaincodeName = null;
  if (channelName === 'topcoder-review') {
    chaincodeName = 'topcoder-review';
  } else {
    chaincodeName = 'topcoder-client';
  }
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  return await fabricService.queryByChaincode(client, client.getChannel(channelName),
    chaincodeName, 'listProjects', [], false);
}

/**
 * The schema for list.
 */
list.schema = {
  operator: Joi.operator().required(),
  channelName: Joi.string().valid('topcoder-client', 'topcoder-review').required()
};


module.exports = {
  create,
  update,
  get,
  list
};

logger.buildService(module.exports);