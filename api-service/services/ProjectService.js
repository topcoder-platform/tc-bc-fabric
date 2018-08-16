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
 * Creates a project.
 * @param payload the payload.
 * @returns {Promise<*>} the result.
 */
async function create(payload) {
  payload.status = 'draft';

  const projectId = payload.projectId;

  const client = await userService.validateUserAndEnroll(payload.createdBy, ['manager', 'client']);

  const eProject = await fabricService.queryByChaincode(client, client.getChannel('topcoder-client'),
    'projects', 'getProject', [projectId], false);

  if (eProject) {
    throw new errors.ConflictError(`project ${projectId} already exists.`);
  }

  await fabricService.invokeChainCode(client, client.getChannel('topcoder-client'), 'projects', 'createProject',
    [JSON.stringify(payload)], false);

  return payload;
}

/**
 * The schema for create.
 */
create.schema = {
  payload: Joi.object().keys({
    projectId: Joi.id(),
    copilotId: Joi.optionalId(),
    name: Joi.string().required(),
    description: Joi.string(),
    budget: Joi.number().min(0).required(),
    status: Joi.string().valid('active', 'draft'),
    createdBy: Joi.emailId()
  })
};

/**
 * Updates a project.
 * @param projectId the id of the project.
 * @param payload the payload.
 * @returns {Promise<*>} the result.
 */
async function update(projectId, payload) {
  const client = await userService.validateUserAndEnroll(payload.updatedBy, ['manager', 'client']);

  const eProject = await fabricService.queryByChaincode(client, client.getChannel('topcoder-client'),
    'projects', 'getProject', [projectId], false);

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
  await fabricService.invokeChainCode(client, client.getChannel('topcoder-client'),
    'projects', 'updateProject', [JSON.stringify(payload)], false);


  if (eProject.status === 'draft' && payload.status !== 'draft') {
    const updatedProject = await fabricService.queryByChaincode(client, client.getChannel('topcoder-client'),
      'projects', 'getProject', [projectId], false);
    const topcoderReviewPayload = _.extend({}, updatedProject);
    delete topcoderReviewPayload.budget;
    // copy and create this project in topcoder-review channel
    await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'), 'projects', 'createProject',
      [JSON.stringify(topcoderReviewPayload)], false);

  } else if (eProject.status !== 'draft') {
    const topcoderReviewPayload = _.extend({}, payload);
    delete topcoderReviewPayload.budget;
    // update the project in topcoder-review channel
    await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'), 'projects', 'updateProject',
      [JSON.stringify(topcoderReviewPayload)], false);
  }

  // return the result from the topcoder-client channel
  return await fabricService.queryByChaincode(client, client.getChannel('topcoder-client'),
    'projects', 'getProject', [projectId], false);
}

/**
 * The schema for update.
 */
update.schema = {
  projectId: Joi.id(),
  payload: Joi.object().keys({
    projectId: Joi.id(),
    copilotId: Joi.optionalId(),
    name: Joi.string(),
    description: Joi.string(),
    budget: Joi.number().min(0),
    status: Joi.string().valid('draft', 'active'),
    updatedBy: Joi.emailId()
  })
};

/**
 * Gets the project by id.
 * @param projectId the id of the project.
 * @param channelName the channel name.
 * @returns {Promise<*>} the result.
 */
async function get(projectId, channelName) {
  const client = await fabricService.getClientForOrg('Topcoder');
  return await fabricService.queryByChaincode(client, client.getChannel(channelName),
    'projects', 'getProject', [projectId], true);
}

/**
 * The schema for get.
 */
get.schema = {
  projectId: Joi.id(),
  channelName: Joi.string().valid('topcoder-client', 'topcoder-review').required()
};

/**
 * Lists the projects of a channel.
 * @param channelName the name of the channel.
 * @returns {Promise<*>} the result.
 */
async function list(channelName) {
  const client = await fabricService.getClientForOrg('Topcoder');
  return await fabricService.queryByChaincode(client, client.getChannel(channelName),
    'projects', 'listProjects', [], true);
}

/**
 * The schema for list.
 */
list.schema = {
  channelName: Joi.string().valid('topcoder-client', 'topcoder-review').required()
};


module.exports = {
  create,
  update,
  get,
  list
};

logger.buildService(module.exports);