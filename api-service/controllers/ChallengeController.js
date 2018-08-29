/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file is the controller for challenge APIs.
 * @author TCSDEVELOPER
 * @version 1.0
 */
const config = require('config');
const mime = require('mime-types')

const service = require('../services/ChallengeService');
const multer = require('multer')
const upload = multer({dest: config.fileUploadTMPDirectory});

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


/**
 * Uploads a submission. The submission file will be stored in the IPFS and
 * the submission info will store in the blockchain ledger.
 *
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the response of the result.
 */
async function uploadSubmission(req, res) {
  const challengeId = req.params.challengeId;
  const payload = req.body;
  payload.challengeId = challengeId;
  res.json(await service.uploadSubmission(req.file, req.body));
}

// the multipart file upload handler
uploadSubmission.uploader = upload.single('file');


/**
 * Downloads a submission.
 * @param req the download request.
 * @param res the response.
 * @returns {Promise<void>} the file content.
 */
async function downloadSubmission(req, res) {
  const request = {
    submissionId: req.params.submissionId,
    challengeId: req.params.challengeId,
    memberId: req.cookies['memberId']
  };

  const {fileName, content} = await service.downloadSubmission(request);

  // set the download headers
  res.set({
    "Content-Type": mime.contentType(fileName) || "application/octet-stream",
    "Content-Disposition": "attachment; filename=" + fileName
  });
  res.send(content);
}

module.exports = {
  create,
  update,
  registerChallenge,
  unregisterChallenge,
  uploadSubmission,
  downloadSubmission
};