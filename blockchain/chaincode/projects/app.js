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
    checkRole(stub, ['manager', 'client']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    if (!payload.projectId) {
      throw new errors.ValidationError('projectId is required');
    }
    console.log(this);
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
    checkRole(stub, ['manager', 'client']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    if (!payload.projectId) {
      throw new errors.ValidationError('projectId is required');
    }
    if (!payload.updatedBy) {
      throw new errors.ValidationError('updatedBy is required');
    }

    const eProject = await this.__getProject(stub, payload.projectId);
    if (eProject === null) {
      throw new errors.BadRequestError('cannot find project with id: ' + payload.projectId
        + '. Maybe it is not created or not active yet.');
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
    eProject.updatedBy = payload.updatedBy;
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
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for email)');
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
    checkRole(stub, ['manager', 'copilot']);
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
    checkRole(stub, ['manager', 'copilot']);
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
    if (payload.name) {
      challenge.name = payload.name;
    }
    if (payload.description) {
      challenge.description = payload.description;
    }
    challenge.updatedBy = payload.updatedBy;

    await this.__saveChallenge(stub, challenge);

    const project = await this.__getProject(stub, challenge.projectId);
    if (!project) {
      throw new errors.BadRequestError('cannot find project with id: ' + challenge.projectId);
    }

    const challenges = project.challenges || [];
    let found = false;
    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      if (c.challengeId === challenge.challengeId) {
        found = true;
        // retain the members
        challenge.members = c.members;
        challenges[i] = challenge;
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
    const member = JSON.parse(args[0]);

    return await this.__updateMember(stub, member, 1);
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
    const member = JSON.parse(args[0]);

    return await this.__updateMember(stub, member, 0);
  }


  /**
   * Uploads the submission.
   * @param stub the stub.
   * @param args the arguments
   * @returns {Promise<any>} the uploaded submission entity.
   */
  async uploadSubmission(stub, args) {
    checkRole(stub, ['member']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const submission = JSON.parse(args[0]);
    const challengeId = submission.challengeId;
    delete  submission.challengeId;

    // find the challenge from the project
    const {project, challenge} = await this.__getProjectChallenge(stub, challengeId);

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
      permitted = true;
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
      if (registerMember) {
        permitted = true;
      }
    }
    if (!permitted) {
      throw new errors.ForbiddenError('You cannot download the submission. You must be a manager, ' +
        'or the copilot of the project, or a registered member of the challenge');
    }

    return submission;
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