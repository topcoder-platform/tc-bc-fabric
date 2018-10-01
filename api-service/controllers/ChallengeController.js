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
  res.json(await service.create(req.user, req.body));
}

/**
 * Updates a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function update(req, res) {
  res.json(await service.update(req.user, req.params.challengeId, req.body));
}

/**
 * Lists all the challenges.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function list(req, res) {
  res.json(await service.list());
}

/**
 * Gets a challenge detail.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function get(req, res) {
  res.json(await service.get(req.params.challengeId));
}

/**
 * Registers a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function registerChallenge(req, res) {
  res.json(await service.registerChallenge(req.user, req.params.challengeId));
}

/**
 * Unregisters a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function unregisterChallenge(req, res) {
  res.json(await service.unregisterChallenge(req.user, req.params.challengeId));
}

/**
 * Registers a reviewer to a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function registerReviewer(req, res) {
  res.json(await service.registerReviewer(req.user, req.params.challengeId, req.params.userId));
}

/**
 * Unregsters a reviewers in a challenge.
 * @param req the request.
 * @param res the response.
 * @returns {Promise<void>} the promise of the result.
 */
async function unregisterReviewer(req, res) {
  res.json(await service.unregisterReviewer(req.user, req.params.challengeId, req.params.userId));
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
  res.json(await service.uploadSubmission(req.user, req.file, req.body));
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
    challengeId: req.params.challengeId
  };

  const {fileName, content} = await service.downloadSubmission(req.user, request);

  // set the download headers
  res.set({
    "Content-Type": mime.contentType(fileName) || "application/octet-stream",
    "Content-Disposition": "attachment; filename=" + fileName
  });
  res.send(content);
}


/**
 * Downloads a submission.
 * @param req the download request.
 * @param res the response.
 * @returns {Promise<void>} the file content.
 */
async function downloadWinningSubmission(req, res) {
  const request = {
    challengeId: req.params.challengeId
  };

  const {fileName, content} = await service.downloadWinningSubmission(req.user, request);

  // set the download headers
  res.set({
    "Content-Type": mime.contentType(fileName) || "application/octet-stream",
    "Content-Disposition": "attachment; filename=" + fileName
  });
  res.send(content);
}

/**
 * Creates a scorecard.
 * @param req the request
 * @param res the response.
 * @returns {Promise<void>} the scorecard.
 */
async function createScorecard(req, res) {
  res.json(await service.createScorecard(req.user, req.params.challengeId, req.body));
}

/**
 * Creates a challenge review.
 * @param req the request
 * @param res the response.
 * @returns {Promise<void>} the scorecard.
 */
async function createChallengeReview(req, res) {
  res.json(await service.createChallengeReview(req.user, req.params.challengeId, req.body));
}

/**
 * Creates a appeal.
 * @param req the request
 * @param res the response.
 * @returns {Promise<void>} the scorecard.
 */
async function createAppeal(req, res) {
  res.json(await service.createAppeal(req.user, req.params.challengeId, req.body));
}

/**
 * Creates a appeal response.
 * @param req the request
 * @param res the response.
 * @returns {Promise<void>} the scorecard.
 */
async function createAppealResponse(req, res) {
  res.json(await service.createAppealResponse(req.user, req.params.challengeId, req.body));
}

module.exports = {
  create,
  update,
  list,
  get,

  registerChallenge,
  unregisterChallenge,
  registerReviewer,
  unregisterReviewer,

  uploadSubmission,
  downloadSubmission,
  downloadWinningSubmission,

  createScorecard,
  createChallengeReview,
  createAppeal,
  createAppealResponse

};