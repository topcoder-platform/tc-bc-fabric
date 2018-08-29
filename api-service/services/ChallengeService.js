/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This is the file for challenge service.
 *
 * @author TCSDEVELOPER
 * @version 1.0
 */
const fs = require('fs');
const Joi = require('joi');
const logger = require('../utils/logger');
const helper = require('../utils/helper');
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

/**
 * Uploads a submission. The submission file will be stored in the IPFS and
 * the submission info will store in the blockchain ledger.
 * @param file the uploaded file info.
 * @param payload the payload
 */
async function uploadSubmission(file, payload) {

  try {
    const challengeId = payload.challengeId;
    const submissionId = payload.submissionId;
    const originalFileName = payload.fileName || file.originalname;
    const fileName = `submission_${submissionId}_${originalFileName}`;
    const ipfsResult = await helper.ipfsAdd(file.path);
    // prepare the chaincode payload
    const chaincodePayload = {
      submissionId,
      challengeId: challengeId,
      memberId: payload.memberId,
      originalFileName,
      fileName,
      ipfsHash: ipfsResult.hash,
      timestamp: new Date().toISOString()
    };

    // save the file metadata to blockchain
    const client = await userService.validateUserAndEnrollById(payload.memberId, ['member']);
    await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
      'projects', 'uploadSubmission', [JSON.stringify(chaincodePayload)], false);
    return chaincodePayload;
  } finally {
    // remove the temp uploaded file
    fs.unlink(file.path, () => {});
  }
}

/**
 * This is the schema for upload the submission.
 */
uploadSubmission.schema = {
  file: Joi.object().keys({
    path: Joi.string().required(),
    originalname: Joi.string().required()
  }).unknown().required(),
  payload: Joi.object().keys({
    challengeId: Joi.id(),
    memberId: Joi.id(),
    // this fileName is optional, if not set, use the original file name
    // (i.e, the file name in local file system before uploading)
    fileName: Joi.string(),
    submissionId: Joi.id()
  })
};

/**
 * Downloads the submission.
 * @param request the download request.
 * @returns {Promise<{content: *, fileName: string}>} the download result.
 */
async function downloadSubmission(request) {
  const client = await userService.validateUserAndEnrollById(request.memberId, ['member', 'manager', 'copilot']);
  const submission = await fabricService.queryByChaincode(
    client, client.getChannel('topcoder-review'), 'projects', 'getSubmission', [JSON.stringify(request)], false);
  const result = await helper.ipfsGet(submission.ipfsHash);
  return {
    content: result.content,
    fileName: submission.fileName
  };
}

/**
 * This is the schema of the request for download the submission.
 */
downloadSubmission.schema = {
  request: Joi.object().keys({
    memberId: Joi.id(),
    submissionId: Joi.id(),
    challengeId: Joi.id()
  })
};
module.exports = {
  create,
  update,
  registerChallenge,
  unregisterChallenge,
  uploadSubmission,
  downloadSubmission
};

logger.buildService(module.exports);