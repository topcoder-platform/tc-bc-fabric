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
const uuidv4 = require('uuid/v4');

const logger = require('../utils/logger');
const helper = require('../utils/helper');
const errors = require('../utils/errors');
const userService = require('./UserService');
const fabricService = require('./FabricService');
const _ = require('lodash');
/**
 * Validates all the phases.
 * @param phases the phases.
 * @private
 */
const __validatePhases = (phases) => {
  const allPhasesNames = ['Register', 'Submission', 'Review', 'Appeal', 'AppealResponse', 'Completed'];
  if (phases.length !== allPhasesNames.length) {
    throw new errors.ValidationError('The phases should exactly contains the phases: ' + allPhasesNames.join(','));
  }
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (phase.name !== allPhasesNames[i]) {
      throw new errors.ValidationError('The phases should in this order: ' + allPhasesNames.join(','));
    }
    let previousPhase = null;
    if (i > 0) {
      previousPhase = phases[i - 1];
    }
    if (previousPhase && new Date(previousPhase.endDate).getTime() !== new Date(phase.startDate).getTime()) {
      throw new errors.ValidationError('The end date in phase: ' + phase.name
        + ' should be the same as the end date of the previous phase: ' + previousPhase.name);
    }

    if (new Date(phase.endDate).getTime() < new Date(phase.startDate).getTime()) {
      throw new errors.ValidationError('The start date should less than the end date in phase: ' + phase.name);
    }
  }

};

/**
 * Creates the challenge.
 * @param operator the current operator.
 * @param payload the challenge payload.
 * @returns {Promise<*>} the result.
 */
async function create(operator, payload) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  payload.createdBy = operator.memberId;
  payload.currentPhase = 'Pending';
  __validatePhases(payload.phases);
  console.log(JSON.stringify(payload));
  payload.reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'createChallenge', [JSON.stringify(payload)], false);
  return payload;
}

/**
 * The validate schema for create.
 */
create.schema = {
  operator: Joi.operator().required(),
  payload: Joi.object().keys({
    challengeId: Joi.id(),
    projectId: Joi.id(),
    name: Joi.string().required(),
    description: Joi.string(),
    phases: Joi.array().items({
      name: Joi.string().required(),
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().required()
    }).required(),
    prizes: Joi.object().keys({
      winners: Joi.array().items(Joi.number()).required(),
      reviewer: Joi.number().required(),
      copilot: Joi.number().required()
    }).required()
  })
};

/**
 * Updates a challenge.
 * @param operator the current operator.
 * @param challengeId the challenge id.
 * @param payload the payload.
 * @returns {Promise<*>} the result.
 */
async function update(operator, challengeId, payload) {
  if (payload.phases) {
    __validatePhases(payload.phases);
  }
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  payload.updatedBy = operator.memberId;
  payload.reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'updateChallenge', [JSON.stringify(payload)], false);
  return payload;
}


/**
 * The schema for update.
 */
update.schema = {
  operator: Joi.operator().required(),
  challengeId: Joi.id(),
  payload: Joi.object().keys({
    challengeId: Joi.id(),
    name: Joi.string(),
    description: Joi.string(),
    phases: Joi.array().items({
      name: Joi.string().required(),
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().required()
    }),
    prizes: Joi.object().keys({
      winners: Joi.array().items(Joi.number()).required(),
      reviewer: Joi.number().required(),
      copilot: Joi.number().required()
    })
  })
};


/**
 * Lists the challenges.
 * @returns {Promise<*>} the challenges.
 */
async function list() {
  const client = await fabricService.getClientForOrg('Topcoder');
  return await fabricService.queryByChaincode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'listChallenges', [], true);
}

/**
 * Gets a challenge detail.
 * @param challengeId the id of the challenge.
 * @returns {Promise<*>} the result.
 */
async function get(challengeId) {
  const client = await fabricService.getClientForOrg('Topcoder');
  return await fabricService.queryByChaincode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'getChallenge', [challengeId], true);
}

get.schema = {
  challengeId: Joi.id()
};


/**
 * Registers a challenge.
 * @param operator the current operator.
 * @param challengeId the challenge id to register.
 * @returns {Promise<void>} the result.
 */
async function registerChallenge(operator, challengeId) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  const reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'registerChallenge', [JSON.stringify({challengeId})], false);
  return {
    reviewTransactionId
  };
}



/**
 * The schema for register.
 */
registerChallenge.schema = {
  operator: Joi.operator().required(),
  challengeId: Joi.id()
};

/**
 * Unregister a challenge
 * @param operator the current operator.
 * @param challengeId the challenge id to unregister.
 * @returns {Promise<void>} the result.
 */
async function unregisterChallenge(operator, challengeId) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  const reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'unregisterChallenge', [JSON.stringify({challengeId})], false);
  return {
    reviewTransactionId
  };
}


unregisterChallenge.schema = registerChallenge.schema;

/**
 * Will register a reviewer to a challenge. Needs manager or copilot role
 * @param operator the current operatator.
 * @param challengeId the challenge id.
 * @param reviewerId the reviewer user id.
 * @returns {Promise<void>} the result.
 */
async function registerReviewer(operator, challengeId, reviewerId) {
  // validate the reviewer role
  const reviewer = await userService.getById(reviewerId);
  if (!reviewer) {
    throw new errors.BadRequestError('cannot find the reviewer with id: ' + reviewerId);
  }
  if (reviewer.roles.indexOf('reviewer') < 0) {
    throw new errors.BadRequestError('the user with id: ' + reviewerId + ' is not a reviewer');
  }

  const client = await userService.enrollUser(operator, operator.permittedRoles);
  const reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'registerReviewer', [JSON.stringify({challengeId, memberId: reviewerId})], false);
  return {
    reviewTransactionId
  };
}

/**
 * Represents the schema to register a reviewer.
 */
registerReviewer.schema = {
  operator: Joi.operator().required(),
  challengeId: Joi.id(),
  reviewerId: Joi.id()
};

/**
 * Will unregister a reviewer to a challenge. Needs manager or copilot role
 * @param operator the current operatator.
 * @param challengeId the challenge id.
 * @param reviewerId the reviewer user id.
 * @returns {Promise<void>} the result.
 */
async function unregisterReviewer(operator, challengeId, reviewerId) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  const reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'unregisterReviewer', [JSON.stringify({challengeId, memberId: reviewerId})], false);
  return {
    reviewTransactionId
  };
}

unregisterReviewer.schema = registerReviewer.schema;





/**
 * Uploads a submission. The submission file will be stored in the IPFS and
 * the submission info will store in the blockchain ledger.
 * @param operator the current operator.
 * @param file the uploaded file info.
 * @param payload the payload
 */
async function uploadSubmission(operator, file, payload) {

  try {
    if (operator.permittedRoles.length === 1 && operator.permittedRoles[0] === 'member') {
      if (payload.memberId !== operator.memberId) {
        throw new errors.ForbiddenError('You cannot upload the submission for another member');
      }
    }

    const challengeId = payload.challengeId;
    const submissionId = uuidv4();
    const originalFileName = file.originalname;
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
    const client = await userService.enrollUser(operator, operator.permittedRoles);
    chaincodePayload.reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
      'topcoder-review', 'uploadSubmission', [JSON.stringify(chaincodePayload)], false);
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
  operator: Joi.operator().required(),
  file: Joi.object().keys({
    path: Joi.string().required(),
    originalname: Joi.string().required()
  }).unknown().required(),
  payload: Joi.object().keys({
    challengeId: Joi.id(),
    memberId: Joi.id()
  })
};

/**
 * Downloads the submission.
 * @param operator the current operator.
 * @param request the download request.
 * @returns {Promise<{content: *, fileName: string}>} the download result.
 */
async function downloadSubmission(operator, request) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  request.memberId = operator.memberId;
  const submission = await fabricService.queryByChaincode(
    client, client.getChannel('topcoder-review'), 'topcoder-review', 'getSubmission', [JSON.stringify(request)], false);
  const result = await helper.ipfsGet(submission.ipfsHash);
  return {
    content: result.content,
    fileName: submission.fileName
  };
}

/**
 * Downloads the winner submissions.
 * @param operator the current operator.
 * @param request the download request.
 * @returns {Promise<{content: *, fileName: *}>} the result.
 */
async function downloadWinningSubmission(operator, request) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  request.memberId = operator.memberId;
  const submission = await fabricService.queryByChaincode(
    client, client.getChannel('topcoder-client'), 'topcoder-client', 'getSubmission', [JSON.stringify(request)], false);
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
  operator: Joi.operator().required(),
  request: Joi.object().keys({
    submissionId: Joi.id(),
    challengeId: Joi.id()
  })
};


/**
 * Creates a scorecard.
 * @param operator the operator.
 * @param challengeId id of the challenge.
 * @param scorecard the scorecard to create.
 * @returns {Promise<void>} the result.
 */
async function createScorecard(operator, challengeId, scorecard) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  scorecard.reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'createChallengeScorecard', [challengeId, JSON.stringify(scorecard)], false);
  return scorecard;
}

/**
 * Reprsents the schema for createScorecard.
 */
createScorecard.schema = {
  operator: Joi.operator().required(),
  challengeId: Joi.id(),
  scorecard: Joi.object().keys({
    name: Joi.string().required(),
    questions: Joi.array().items({
      text: Joi.string().required(),
      weight: Joi.number().min(0).max(1).required(),
      order: Joi.number().integer().required()
    })
  }).required()
};

/**
 * Creates the challenge review.
 * @param operator the operator.
 * @param challengeId the id of the challenge.
 * @param review the review.
 * @returns {Promise<*>} the promise of the result.
 */
async function createChallengeReview(operator, challengeId, review) {
  if (operator.permittedRoles.length === 1 && operator.permittedRoles[0] === 'reviewer') {
    if (operator.memberId !== review.reviewerId) {
      throw new errors.ForbiddenError('The reviewerId is not the same as the logged in reviewer');
    }
  }
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  review.reviewTransactionId = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'createChallengeReview',
    [challengeId, JSON.stringify(review)], false);
  return review;
}

/**
 * Reprsents the schema of create challenge review.
 */
createChallengeReview.schema = {
  operator: Joi.operator().required(),
  challengeId: Joi.id(),
  review: Joi.object().keys({
    reviewerId: Joi.id(),
    memberId: Joi.id(),
    review: Joi.array().items({
      score: Joi.number().required(),
      question: Joi.number().integer().required(),
      comments: Joi.string()
    }).required()
  }).required()
};

/**
 * Creates an appeal.
 * @param operator the current operator.
 * @param challengeId the id of the challenge.
 * @param appeal the appeal.
 * @returns {Promise<*>} the result.
 */
async function createAppeal(operator, challengeId, appeal) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  appeal.reviewTransactionId = await fabricService.invokeChainCode(
    client, client.getChannel('topcoder-review'), 'topcoder-review', 'createAppeal',
    [challengeId, JSON.stringify(appeal)], false);
  return appeal;
}

/**
 * Represents the schema of the create appeal.
 */
createAppeal.schema = {
  operator: Joi.operator().required(),
  challengeId: Joi.id(),
  appeal: Joi.object().keys({
    reviewerId: Joi.id(),
    memberId: Joi.id(),
    appeal: Joi.object().keys({
      text: Joi.string().required(),
      question: Joi.number().integer().required()
    })
  }).required()
};

/**
 * Creates an appeal response.
 * @param operator the current operator.
 * @param challengeId the id of the challenge.
 * @param appealResponse the appeal response.
 * @returns {Promise<*>} the result.
 */
async function createAppealResponse(operator, challengeId, appealResponse) {
  const client = await userService.enrollUser(operator, operator.permittedRoles);
  if (operator.permittedRoles.length === 1 && operator.permittedRoles[0] === 'reviewer') {
    if (operator.memberId !== appealResponse.reviewerId) {
      throw new errors.ForbiddenError('The reviewerId is not the same as the logged in reviewer');
    }
  }
  appealResponse.reviewTransactionId = await fabricService.invokeChainCode(
    client, client.getChannel('topcoder-review'), 'topcoder-review', 'createAppealResponse',
    [challengeId, JSON.stringify(appealResponse)], false);
  return appealResponse;
}

/**
 * Represents the schema of the create appeal.
 */
createAppealResponse.schema = {
  operator: Joi.operator().required(),
  challengeId: Joi.id(),
  appealResponse: Joi.object().keys({
    reviewerId: Joi.id(),
    memberId: Joi.id(),
    appealResponse: Joi.object().keys({
      text: Joi.string().required(),
      question: Joi.number().integer().required(),
      finalScore: Joi.number().required()
    })
  }).required()
};

/**
 * Calculates the review score for a single review.
 * @param scorecard the scorecard.
 * @param review the review.
 * @returns {number} the number of the review.
 * @private
 */
function __calculateReviewScoreForSingleReview(scorecard, review) {
    const questionMappings = {};

    for (let i = 0; i < scorecard.questions.length; i++) {
        questionMappings[scorecard.questions[i].order] = scorecard.questions[i];
    }

    let sum = 0;
    for (let i = 0; i < review.review.length; i++) {
        const question = questionMappings[review.review[i].question];
        if (!question) {
            throw new errors.BadRequestError(
                'cannot find question in scorecard with question order: ' + reviewQuestion.question);
        }

        let score = review.review[i].score;
        if (review.review[i].appeal && !_.isNil(review.review[i].appeal.finalScore)) {
            score = review.review[i].appeal.finalScore;
        }

        sum += question.weight * score;
    }

    return sum;
}

/**
 * Calculate the review scores.
 * @param scorecard the scorecard.
 * @param submission the submission.
 * @returns {number} the number of the review score.
 * @private
 */
function __calculateReviewScore(scorecard, submission) {
  let sum = 0;
  let reviewCount = 0;

  for(let i = 0; i < submission.reviews.length; i++) {
    reviewCount++;
    sum += __calculateReviewScoreForSingleReview(scorecard, submission.reviews[i]);    
  }
  
  if (reviewCount === 0) {
    return 0;
  }
  
  return sum;
}

/**
 * Calculates a winner of the challenge.
 * @param challenge the challenge.
 * @returns {Array} the winners of the challenge.
 * @private
 */
function __calculateChallengeWinners(challenge) {
  // calculate the winners
  let candidates = [];

    for(let i = 0; i < challenge.submissions.length; i++) {
        let score = __calculateReviewScore(challenge.scorecard, challenge.submissions[i]);

        candidates.push({
            memberId: challenge.submissions[i].memberId,
            score,
            timestamp: challenge.submissions[i].timestamp,
            submission: {
            submissionId: challenge.submissions[i].submissionId,
            originalFileName: challenge.submissions[i].originalFileName,
            fileName: challenge.submissions[i].fileName,
            ipfsHash: challenge.submissions[i].ipfsHash,
            timestamp: challenge.submissions[i].timestamp
            }
        });
    }

  candidates = candidates.sort((a, b) => {
    // compare the scores then the timestamp
    const d1 = new Date(a.timestamp).getTime();
    const d2 = new Date(b.timestamp).getTime();
    if (a.score < b.score) {
      return 1;
    } else if (a.score > b.score) {
      return -1;
    } else if (d1 < d2) {
      return -1;
    } else if (d1 > d2) {
      return 1;
    } else {
      return 0;
    }
  });

  const winners = [];
  for (let i = 0; i < candidates.length && i < challenge.prizes.winners.length; i++) {
    winners.push({
      memberId: candidates[i].memberId,
      score: candidates[i].score,
      prize: challenge.prizes.winners[i],
      submission: candidates[i].submission
    });
  }
  return winners;
}

/**
 * On challenge completed.
 * @param app the application.
 * @param challengeId the challenge id.
 * @returns {Promise<void>} the result.
 * @private
 */
async function __onChallengeCompleted(app, challengeId) {
  // get the challenge from the challenge id
  const challenge = await get(challengeId);

  const client = await fabricService.getClientForOrg('Topcoder');
  // copy the challenge to topcoder-client channel.
  await fabricService.invokeChainCode(client, client.getChannel('topcoder-client'), 'topcoder-client', 'onChallengeCompleted',
    [JSON.stringify(challenge)], true);

  // trigger the challenge completed event
  app.emit('ChallengeCompleted', challenge);
}

/**
 * Updates the challenge phase.
 * @param app the application.
 * @param challenge the challenge to update.
 * @param phaseName the name of the phase.
 * @returns {Promise<string>} the result.
 */
async function updateChallengePhase(app, challenge, phaseName) {
  const phases = JSON.parse(JSON.stringify(challenge.phases));
  console.log(phases)
  // update the times of the phases
  let index = -1;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (phase.name === phaseName) {
      index = i;
      break;
    }
  }
  if (index < 0) {
    throw new errors.BadRequestError('cannot find the phase with name: ' + phaseName);
  }
  const previousPhaseIndex = index - 1;
  const now = new Date();
  let previousPhase = null;
  if (previousPhaseIndex >= 0) {
    // update the end time of the previous phase
    previousPhase = phases[previousPhaseIndex];
    previousPhase.endDate = now;
  }
  // for the current and following phases, shift the time ranges
  for (let i = index; i < phases.length; i++) {
    const phase = phases[i];
    let duration = 0;
    if (phase.endDate && phase.startDate) {
      duration = new Date(phase.endDate).getTime() - new Date(phase.startDate).getTime();
    }
    if (previousPhase) {
      phase.startDate = previousPhase.endDate;
    } else {
      phase.startDate = now;
    }

    if (phase.endDate) {
      phase.endDate = new Date(phase.startDate.getTime() + duration);
    }

    previousPhase = phase;
  }

  const mutation = {
    challengeId: challenge.challengeId,
    currentPhase: phaseName,
    phases: phases
  };
  if (phaseName === 'Completed') {
    mutation.winners = __calculateChallengeWinners(challenge);
  }
  // use the system admin to update
  const client = await fabricService.getClientForOrg('Topcoder');
  const result = await fabricService.invokeChainCode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'updateChallenge', [JSON.stringify(mutation)], true);
  if (phaseName === 'Completed') {
    // trigger the onCompleted jobs
    await __onChallengeCompleted(app, challenge.challengeId);
  }
  return result;

}

/**
 * Gets all the on going challenges.
 * @returns {Promise<*>} all the on going challenges
 */
const getOnGoingChallenges = async () => {
  const client = await fabricService.getClientForOrg('Topcoder');
  return await fabricService.queryByChaincode(client, client.getChannel('topcoder-review'),
    'topcoder-review', 'getOnGoingChallenges', [], true);
};


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
  createAppealResponse,

  updateChallengePhase,
  getOnGoingChallenges
};

logger.buildService(module.exports);
