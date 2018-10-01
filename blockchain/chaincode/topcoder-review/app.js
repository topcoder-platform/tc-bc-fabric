/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

'use strict';
const shim = require('fabric-shim');
const _ = require('lodash');
const errors = require('./errors');

const ClientIdentity = shim.ClientIdentity;

/**
 * This is the helper method to get the organization from role.
 * @param role the role
 * @returns {*} the organization or null.
 */
function roleToOrganization(role) {
  const mappings = {
    client: "Clients",
    manager: "Topcoder",
    member: "Members",
    copilot: "Moderators",
    reviewer: "Moderators"
  };
  return mappings[role];
}

/**
 * Checks the role for permissions.
 * @param stub the stub.
 * @param permittedRoles the permitted roles.
 * @returns {Array} the roles of the user.
 */
const checkRole = (stub, permittedRoles) => {
  let cid = new ClientIdentity(stub);

  // get the role by Attributed Base Access Control
  let rolesABA = cid.getAttributeValue('roles');
  if (!rolesABA) {
    rolesABA = 'admin';
  }

  const roles = rolesABA.split(',');

  const validRoles = [];
  for (let role of roles) {
    if (permittedRoles.indexOf(role) >= 0) {
      validRoles.push(role);
    }
  }

  if (roles.indexOf('admin') >= 0) {
    // we always allow admin access
    return roles;
  }


  if (validRoles.length === 0) {
    throw new errors.ForbiddenError(
      'Access denied. Only these roles can perform this operation: ' + permittedRoles.join(','));
  }

  // validate the MSPID
  let ok = false;
  for (let role of validRoles) {
    const org = roleToOrganization(role);
    if (org === null) {
      throw new errors.ForbiddenError('Access denied. Cannot recognize role: ' + role);
    }
    if (cid.getMSPID() === `${org}MSP`) {
      ok = true;
    }
  }

  if (!ok) {
    throw new errors.ForbiddenError('Access denied. The request is not submitted from a correct organization peer.');
  }

  return roles;
};

/**
 * This is the class for projects chaincode.
 *
 * @author TCSDEVELOPER
 * @version 1.0
 */
let Chaincode = class {

  /**
   * Initializes the chaincode.
   * @param stub the stub.
   * @returns {Promise<*>} the promize.
   */
  async Init(stub) {
    console.info('=========== Instantiated projects chaincode ===========');
    return shim.success();
  }

  /**
   * Invokes a chaincode method.
   * @param stub the stub.
   * @returns {Promise<*>} the promise of the result.
   */
  async Invoke(stub) {
    let ret = stub.getFunctionAndParameters();
    console.info(ret);
    if (!this[ret.fcn]) {
      console.error('no function of name:' + ret.fcn + ' found');
      throw new errors.BadRequestError('Received unknown function ' + ret.fcn + ' invocation');
    }

    let method = this[ret.fcn].bind(this);
    try {
      let payload = await method(stub, ret.params);

      if (payload && !Buffer.isBuffer(payload)) {
        if (!_.isString(payload)) {
          payload = JSON.stringify(payload);
        }
        payload = Buffer.from(payload);
      }

      return shim.success(payload);
    } catch (err) {
      console.log(err);
      return shim.error(err);
    }
  }

  /**
   * Creates a project.
   * @param stub the stub.
   * @param args the args: the user payload.
   * @returns {Promise<*>} the user item.
   */
  async createProject(stub, args) {
    checkRole(stub, ['manager']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    if (!payload.projectId) {
      throw new errors.ValidationError('projectId is required');
    }
    await this.__saveProject(stub, payload);

    return payload;
  }


  /**
   * Creates a project.
   * @param stub the stub.
   * @param args the args: the user payload.
   * @returns {Promise<*>} the user item.
   */
  async updateProject(stub, args) {
    checkRole(stub, ['manager']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    if (!payload.projectId) {
      throw new errors.ValidationError('projectId is required');
    }

    const eProject = await this.__getProject(stub, payload.projectId);
    if (eProject === null) {
      throw new errors.BadRequestError('cannot find project with id: ' + payload.projectId
        + '. Maybe it is not created or not active yet.');
    }
    let cid = new ClientIdentity(stub);
    const memberId = cid.getAttributeValue('userId');
    if (!memberId) {
      throw new errors.ForbiddenError('You should login to perform this operation');
    }

    if (eProject.createdBy !== memberId) {
      throw new errors.ForbiddenError('You cannot update this project because you did not create it');
    }
    if (payload.status) {
      eProject.status = payload.status;
    }
    if (payload.copilotId) {
      eProject.copilotId = payload.copilotId;
    }
    if (payload.description) {
      eProject.description = payload.description;
    }
    if (payload.budget) {
      eProject.budget = payload.budget;
    }
    if (payload.name) {
      eProject.name = payload.name;
    }
    eProject.updatedBy = memberId;

    await this.__saveProject(stub, eProject);

    return eProject;
  }


  /**
   * Gets the project.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<*>} the promise of the retrieved project.
   */
  async getProject(stub, args) {
    checkRole(stub, ['manager', 'client']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for projectId)');
    }
    const projectId = args[0];
    return await this.__getProject(stub, projectId);
  }

  /**
   * Creates a challenge.
   * @param stub the code stub.
   * @param args the arguments.
   * @returns {Promise<*>} the created challenge.
   */
  async createChallenge(stub, args) {
    const roles = checkRole(stub, ['copilot']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for challenge payload)');
    }
    const challenge = JSON.parse(args[0]);
    if (!challenge.projectId) {
      throw new errors.ValidationError('projectId is required');
    }
    if (!challenge.challengeId) {
      throw new errors.BadRequestError('challengeId is required');
    }

    const eChallenge = await this.__getChallenge(stub, challenge.challengeId);
    if (eChallenge) {
      throw new errors.ConflictError('challenge with id ' + challenge.challengeId + ' already exists');
    }

    const project = await this.__getProject(stub, challenge.projectId);
    if (!project) {
      throw new errors.BadRequestError('cannot find project with id: ' + challenge.projectId);
    }
    this.__checkCopilotWithProject(stub, roles, project);

    const challenges = project.challenges || [];

    for (let c of challenges) {
      if (c.challengeId === challenge.challengeId) {
        throw new errors.ConflictError('the challenge with id: ' + c.challengeId + ' already created in this project');
      }
    }

    // save the challenge
    await this.__saveChallenge(stub, challenge);

    challenge.members = [];

    challenges.push(challenge);
    project.challenges = challenges;

    // save the project
    await this.__saveProject(stub, project);

    return challenge;
  }

  /**
   * Updates the challenge.
   * @param stub the code stub.
   * @param args the arguments.
   * @returns {Promise<void>} updates the challenge.
   */
  async updateChallenge(stub, args) {
    const roles = checkRole(stub, ['copilot']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    if (!payload.challengeId) {
      throw new errors.ValidationError('challengeId is required');
    }

    const challenge = await this.__getChallenge(stub, payload.challengeId);
    if (!challenge) {
      throw new errors.BadRequestError('challenge does not exists with id: ' + payload.challengeId);
    }

    // update the challenge
    const mutations = _.pick(payload, ['name', 'description', 'currentPhase', 'prizes', 'updatedBy', 'phases', 'winners']);

    _.assign(challenge, mutations);


    await this.__saveChallenge(stub, challenge);

    const project = await this.__getProject(stub, challenge.projectId);
    if (!project) {
      throw new errors.BadRequestError('cannot find project with id: ' + challenge.projectId);
    }
    this.__checkCopilotWithProject(stub, roles, project);
    const challenges = project.challenges || [];
    let found = false;
    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      if (c.challengeId === challenge.challengeId) {
        found = true;
        // update the meta data for the challenge
        _.assign(challenges[i], mutations);
        break;
      }
    }

    if (!found) {
      throw new errors.BadRequestError(
        'cannot find challenge: ' + challenge.challengeId + ' from project: ' + project.projectId);
    }

    project.challenges = challenges;

    // save the project
    await this.__saveProject(stub, project);
  }

  /**
   * Registers a challenge.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<*>} the registered challenge.
   */
  async registerChallenge(stub, args) {
    checkRole(stub, ['member']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    let cid = new ClientIdentity(stub);
    // get the member id
    const memberId = cid.getAttributeValue('userId');
    if (!memberId) {
      throw new errors.ForbiddenError('You should login to perform this operation');
    }
    payload.memberId = memberId;
    return await this.__updateMember(stub, payload, 1);
  }

  /**
   * Unregisters a challenge.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<*>} the challenge.
   */
  async unregisterChallenge(stub, args) {
    checkRole(stub, ['member']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    let cid = new ClientIdentity(stub);
    // get the member id
    const memberId = cid.getAttributeValue('userId');
    if (!memberId) {
      throw new errors.ForbiddenError('You should login to perform this operation');
    }
    payload.memberId = memberId;
    return await this.__updateMember(stub, payload, 0);
  }

  /**
   * Rgisters a reviewer to the challenge.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<void>} the promise of the result.
   */
  async registerReviewer(stub, args) {
    const roles = checkRole(stub, ['copilot']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    const memberId = payload.memberId;
    const {project, challenge} = await this.__getProjectChallenge(stub, payload.challengeId);
    this.__checkCopilotWithProject(stub, roles, project);
    challenge.reviewers = challenge.reviewers || [];
    // found if the reviewer already exists
    const eReviewer = challenge.reviewers.filter(r => r.memberId === memberId).shift();
    if (eReviewer) {
      throw new errors.ConflictError('the reviewer already registered for this challenge');
    }
    challenge.reviewers.push({
      memberId
    });
    return await this.__saveProject(stub, project);
  }

  /**
   * Unregister a reviewer to a challenge.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<void>} the promise of the result.
   */
  async unregisterReviewer(stub, args) {
    const roles = checkRole(stub, ['copilot']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    const memberId = payload.memberId;
    const {project, challenge} = await this.__getProjectChallenge(stub, payload.challengeId);
    this.__checkCopilotWithProject(stub, roles, project);
    challenge.reviewers = _.filter(challenge.reviewers, r => r.memberId !== memberId);
    return await this.__saveProject(stub, project);
  }

  /**
   * Creates a challenge scorecard.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<void>} the promise of the result.
   */
  async createChallengeScorecard(stub, args) {
    const roles = checkRole(stub, ['copilot', 'manager']);
    if (args.length !== 2) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 2 (for challengeId, scorecard)');
    }
    const challengeId = args[0];
    const scorecard = JSON.parse(args[1]);
    const {project, challenge} = await this.__getProjectChallenge(stub, challengeId);
    this.__checkCopilotWithProject(stub, roles, project);
    challenge.scorecard = scorecard;
    return await this.__saveProject(stub, project);
  }

  /**
   * Creates a challenge review.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<void>} the promise of the result.
   */
  async createChallengeReview(stub, args) {
    const roles = checkRole(stub, ['reviewer']);
    if (args.length !== 2) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 2 (for challengeId, review)');
    }
    const challengeId = args[0];
    const review = JSON.parse(args[1]);
    const {project, challenge} = await this.__getProjectChallenge(stub, challengeId);
    this.__checkCopilotWithProject(stub, roles, project);
    // validate the reviews with the scorecard
    if (!challenge.scorecard) {
      throw new errors.BadRequestError('There is no scorecard in the current challenge yet');
    }
    const scorecardQuestions = {};
    _.forEach(challenge.scorecard.questions, q => {
      scorecardQuestions[q.order] = 'unanswered';
    });
    for (let question of review.review) {
      if (!scorecardQuestions[question.question]) {
        throw new errors.BadRequestError(`cannot find question: ${question.question} in scorecard.`)
      }
      scorecardQuestions[question.question] = 'answered';
    }
    for (let question in scorecardQuestions) {
      if (scorecardQuestions[question] !== 'answered') {
        throw new errors.BadRequestError(`the question with order: ${question} does not exist in the review.`);
      }
    }
    // validate if the reviewId is in the challenge
    const reviewer = _.filter(challenge.reviewers, r => r.memberId === review.reviewerId).shift();
    if (!reviewer) {
      throw new errors.BadRequestError('reviewer is not in the challenge.');
    }
    const memberId = review.memberId;
    const submission = _.filter(challenge.submissions, s => s.memberId === memberId).shift();
    if (!submission) {
      throw new errors.BadRequestError('the member of memberId: '
        + memberId + ' do not have any submission in this challenge');
    }
    submission.reviews = _.filter(submission.reviews, r => r.reviewerId !== review.reviewerId);
    submission.reviews.push({
      reviewerId: review.reviewerId,
      review: review.review
    });

    return await this.__saveProject(stub, project);
  }

  /**
   * Creates an appeal.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<void>} the promise of the result.
   */
  async createAppeal(stub, args) {
    checkRole(stub, ['member']);
    if (args.length !== 2) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 2 (for challengeId, appeal)');
    }
    const challengeId = args[0];
    const appeal = JSON.parse(args[1]);
    const {project, challenge} = await this.__getProjectChallenge(stub, challengeId);
    if (challenge.currentPhase !== 'Appeal') {
      throw new errors.ForbiddenError('You cannot post an appeal because this is not in Appeal phase');
    }
    const reviewerId = appeal.reviewerId;
    const memberId = appeal.memberId;
    const questionOrder = appeal.appeal.question;

    // find the submission
    const question = this.__findQuestion(challenge, reviewerId, memberId, questionOrder);

    question.appeal = _.extend(question.appeal, {
      appeal: appeal.appeal.text
    });

    return await this.__saveProject(stub, project);
  }

  /**
   * Creates the appeal response.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<void>} the response of the result.
   */
  async createAppealResponse(stub, args) {
    const roles = checkRole(stub, ['reviewer']);
    if (args.length !== 2) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 2 (for challengeId, appeal)');
    }
    const challengeId = args[0];
    const appealResponse = JSON.parse(args[1]);
    const {project, challenge} = await this.__getProjectChallenge(stub, challengeId);
    if (challenge.currentPhase !== 'AppealResponse') {
      throw new errors.ForbiddenError(
        'You cannot give an appeal response because this is not the Appeal Response phase');
    }
    this.__checkCopilotWithProject(stub, roles, project);
    const reviewerId = appealResponse.reviewerId;
    const memberId = appealResponse.memberId;
    const questionOrder = appealResponse.appealResponse.question;

    // find the question
    const question = this.__findQuestion(challenge, reviewerId, memberId, questionOrder);
    if (!question.appeal) {
      throw new errors.BadRequestError('There is no such appeal in question: ' + questionOrder);
    }
    question.appeal = _.extend(question.appeal, {
      appealResponse: appealResponse.appealResponse.text,
      finalScore: appealResponse.appealResponse.finalScore
    });

    return await this.__saveProject(stub, project);
  }


  /**
   * Finds the questions in a challenge review.
   * @param challenge the challenge.
   * @param reviewerId the reviewer id.
   * @param memberId the member id.
   * @param questionOrder the questino order.
   * @returns {{question: number, score: number, comments: string} | undefined}
   * @private
   */
  __findQuestion(challenge, reviewerId, memberId, questionOrder) {
    // find the submission
    const submission = _.filter(challenge.submissions, s => s.memberId === memberId).shift();
    if (!submission) {
      throw new errors.BadRequestError('the member of memberId: '
        + memberId + ' do not have any submission in this challenge');
    }
    // find the review
    const review = _.filter(submission.reviews, r => r.reviewerId === reviewerId).shift();
    if (!review) {
      throw new errors.BadRequestError('there is no such review for reviewer: ' + reviewerId);
    }
    // find the question
    const question = _.filter(review.review, q => q.question === questionOrder).shift();
    if (!question) {
      throw new errors.BadRequestError('cannot find the question in the review');
    }
    return question;
  }

  /**
   * Uploads the submission.
   * @param stub the stub.
   * @param args the arguments
   * @returns {Promise<any>} the uploaded submission entity.
   */
  async uploadSubmission(stub, args) {
    checkRole(stub, ['member', 'manager']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const submission = JSON.parse(args[0]);
    const challengeId = submission.challengeId;
    delete  submission.challengeId;

    // find the challenge from the project
    const {project, challenge} = await this.__getProjectChallenge(stub, challengeId);
    if (challenge.currentPhase !== 'Submission') {
      throw new errors.ForbiddenError(
        'You cannot upload a submission because the submission/register phases have ended');
    }
    // check if the member is registered
    const member = _.filter(challenge.members,
      (m) => m.memberId === submission.memberId && m.status === 1).shift();
    if (!member) {
      throw new errors.ForbiddenError(
        `Access denied. member: ${submission.memberId} is not registered in this challenge`);
    }

    // find the existing submission of the member
    let existingIndex = null;
    _.forEach(challenge.submissions, (s, index) => {
      if (s.memberId === submission.memberId) {
        existingIndex = index;
      }
    });
    if (existingIndex !== null) {
      // override the existing submission
      challenge.submissions[existingIndex] = submission;
    } else {
      challenge.submissions = challenge.submissions || [];
      challenge.submissions.push(submission);
    }
    await this.__saveProject(stub, project);
    return submission;
  }

  /**
   * Gets the submission.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<*>} the submission entity.
   */
  async getSubmission(stub, args) {

    const roles = checkRole(stub, ['member', 'manager', 'copilot']);

    const request = JSON.parse(args[0]);

    let cid = new ClientIdentity(stub);
    const currentUserId = cid.getAttributeValue('userId');
    if (!currentUserId) {
      throw new errors.ForbiddenError('You should login to perform this operation');
    }

    const challengeId = request.challengeId;
    const submissionId = request.submissionId;
    const memberId = request.memberId;
    const {project, challenge} = await this.__getProjectChallenge(stub, challengeId);
    const submission = _.filter(challenge.submissions, s => s.submissionId === submissionId).shift();
    if (!submission) {
      throw new errors.BadRequestError(`cannot find submission: ${submissionId} in challenge: ${challengeId}`);
    }
    // validate the permissions
    let permitted = false;
    if (roles.indexOf('manager') >= 0) {
      if (project.createdBy === currentUserId) {
        permitted = true;
      }

    }
    if (roles.indexOf('copilot') >= 0) {
      // check if he is the copilot or the challenge
      if (memberId === project.copilotId) {
        permitted = true;
      }
    }
    if (roles.indexOf('member') >= 0) {
      // check if the member registered the challenge
      const registerMember = _.filter(challenge.members, m => m.memberId === memberId && m.status === 1).shift();
      const hasSubmission = _.filter(challenge.submissions, s => s.memberId === memberId).shift();
      if (registerMember && hasSubmission) {
        permitted = true;
      }
    }
    if (!permitted) {
      throw new errors.ForbiddenError('You cannot download the submission. You must be a manager, ' +
        'or the copilot associated with the project, or a registered member that submitted on this the challenge');
    }

    return submission;
  }

  /**
   * Checks the copilot of the project.
   * @param stub the stub.
   * @param roles the roles.
   * @param project the project.
   * @private
   */
  __checkCopilotWithProject(stub, roles, project) {
    if (roles.length === 1 && roles[0] === 'copilot') {
      let cid = new ClientIdentity(stub);
      const copilotId = cid.getAttributeValue('userId');
      if (project.copilotId !== copilotId) {
        throw new errors.ForbiddenError('You are not the copilot of the project');
      }
    }
  }

  /**
   * Gets the project and challenge instance from he challenge id.
   * @param stub the stub.
   * @param challengeId the challenge id.
   * @returns {Promise<{project: *, challenge: string}>} the project or the challenge.
   * @private
   */
  async __getProjectChallenge(stub, challengeId) {
    let challenge = await this.__getChallenge(stub, challengeId);
    if (!challenge) {
      throw new errors.BadRequestError('cannot find the challenge with id: ' + challengeId);
    }
    const projectId = challenge.projectId;
    const project = await this.__getProject(stub, projectId);
    if (!project) {
      throw new errors.BadRequestError('cannot find the project with id: ' + projectId);
    }
    // find the challenge from the project
    challenge = _.filter(project.challenges, (c) => c.challengeId === challengeId).shift();
    if (!challenge) {
      throw new errors.BadRequestError(`cannot find challenge of id: ${challengeId} in project: ${projectId}`);
    }
    return {project, challenge};
  }

  /**
   * Updates a member.
   * @param stub the stub.
   * @param member the member
   * @param status the status.
   * @returns {Promise<*>} the updated member.
   * @private
   */
  async __updateMember(stub, member, status) {
    if (!member.memberId) {
      throw new errors.ValidationError('memberId is required');
    }
    if (!member.challengeId) {
      throw new errors.ValidationError('challengeId is required');
    }
    const {project, challenge} = await this.__getProjectChallenge(stub, member.challengeId);
    let foundChallenge = challenge;
    if (foundChallenge.currentPhase !== 'Register') {
      throw new errors.ForbiddenError('You can not ' + (status ? 'register' : 'unregister')
        + ' a challenge because current phase of the challenge is not Register.');
    }
    // check if the member exists
    foundChallenge.members = foundChallenge.members || [];
    let found = false;
    for (let i = 0; i < foundChallenge.members.length; i++) {
      const m = foundChallenge.members[i];
      if (member.memberId === m.memberId) {
        if (status === 0) {
          // unregister, check if already provided a submission
          const submission = _.filter(foundChallenge.submissions, s => s.memberId === member.memberId).shift();
          if (submission) {
            throw new errors.ForbiddenError(
              'you cannot unregister this challenge, because you have provided a submission.');
          }
        }
        foundChallenge.members[i] = {
          memberId: member.memberId,
          status: status
        };

        found = true;
      }
    }
    if (!found) {
      //push
      foundChallenge.members.push({
        memberId: member.memberId,
        status: status
      });
    }

    // save the project
    await this.__saveProject(stub, project);

    return member;
  }

  /**
   * Lists all the projects.
   * @param stub the stubs
   * @param args should be empty.
   * @returns {Promise<Array>} all the review items.
   */
  async listProjects(stub, args) {
    checkRole(stub, ['client', 'manager']);

    let iterator = await stub.getStateByRange("prj_", "prj_z");

    let allResults = [];
    while (true) {
      let res = await iterator.next();
      if (res.value && res.value.value.toString()) {
        try {
          allResults.push(JSON.parse(res.value.value.toString('utf8')));
        } catch (err) {
          throw err;
        }
      }

      if (res.done) {
        await iterator.close();
        return allResults;
      }
    }
  }

  /**
   * Lists all the chalelnges.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<Array>} the result.
   */
  async listChallenges(stub, args) {
    let iterator = await stub.getStateByRange("chl_", "chl_z");

    let allResults = [];
    while (true) {
      let res = await iterator.next();
      if (res.value && res.value.value.toString()) {
        try {
          allResults.push(JSON.parse(res.value.value.toString('utf8')));
        } catch (err) {
          throw err;
        }
      }

      if (res.done) {
        await iterator.close();
        return allResults;
      }
    }
  }

  /**
   * Gets the challenge detail.
   * @param stub the stub.
   * @param args args.
   * @returns {Promise<string>} the result.
   */
  async getChallenge(stub, args) {
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for challengeId)');
    }
    const challengeId = args[0];
    const {challenge} = await this.__getProjectChallenge(stub, challengeId);
    return challenge;
  }


  /**
   * Gets all the on going challenges.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<Array>} all the on going challenges.
   */
  async getOnGoingChallenges(stub, args) {
    // get all the projects
    const projects = await this.listProjects(stub, args);
    const challenges = [];
    _.forEach(projects, project => {
      _.forEach(project.challenges, challenge => {
        if (challenge.currentPhase !== 'Completed') {
          challenges.push(challenge);
        }
      });
    });
    return challenges;
  }
  /**
   * Gets the project.
   * @param stub the stub.
   * @param projectId the project id.
   * @returns {Promise<*>} the promise.
   * @private
   */
  async __getProject(stub, projectId) {
    const value = await stub.getState(this.__getProjectKey(projectId));
    if (!value || value.toString().length <= 0) {
      return null;
    }
    return JSON.parse(value.toString());
  }

  /**
   * Gets the challenge.
   * @param stub the stub.
   * @param challengeId the challenge id.
   * @returns {Promise<*>} the promise.
   * @private
   */
  async __getChallenge(stub, challengeId) {
    const value = await stub.getState(this.__getChallengeKey(challengeId));
    if (!value || value.toString().length <= 0) {
      return null;
    }
    return JSON.parse(value.toString());
  }

  /**
   * A helper method to save the project.
   * @param stub the stub.
   * @param project the project.
   * @returns {Promise<void>} the promise.
   * @private
   */
  async __saveProject(stub, project) {
    const key = this.__getProjectKey(project.projectId);
    await stub.putState(key, Buffer.from(JSON.stringify(project)));
  }

  /**
   * A helper method to save the challenge.
   * @param stub the stub.
   * @param challenge the challenge.
   * @returns {Promise<void>} saved challenge.
   * @private
   */
  async __saveChallenge(stub, challenge) {
    const key = this.__getChallengeKey(challenge.challengeId);
    await stub.putState(key, Buffer.from(JSON.stringify(challenge)));
  }

  /**
   * Gets the project key.
   * @param projectId the id of the project.
   * @returns {string} the project id.
   * @private
   */
  __getProjectKey(projectId) {
    return `prj_${projectId}`;
  }

  /**
   * Gets the challenge key.
   * @param challengeId the id of the challenge.
   * @returns {string} the challenge id.
   * @private
   */
  __getChallengeKey(challengeId) {
    return `chl_${challengeId}`;
  }
};



module.exports = Chaincode;
