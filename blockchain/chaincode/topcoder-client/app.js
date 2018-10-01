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
    const roles = checkRole(stub, ['manager', 'client']);
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for projectId)');
    }
    let isClient = false;
    if (roles.length === 1 && roles[0] === 'client') {
      isClient = true;
    }
    let cid = new ClientIdentity(stub);
    const memberId = cid.getAttributeValue('userId');

    const projectId = args[0];
    const project = await this.__getProject(stub, projectId);
    if (isClient && project.clientId !== memberId) {
      throw new errors.ForbiddenError('This project is not associate with the given client');
    }
    return project;
  }

  /**
   * Gets the submission.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<*>} the submission entity.
   */
  async getSubmission(stub, args) {
    const roles = checkRole(stub, ['manager', 'client']);
    const request = JSON.parse(args[0]);
    const challengeId = request.challengeId;

    let cid = new ClientIdentity(stub);
    const currentUserId = cid.getAttributeValue('userId');
    if (!currentUserId) {
      throw new errors.ForbiddenError('You should login to perform this operation');
    }

    const {project, challenge} = await this.__getProjectChallenge(stub, challengeId);
    // validate the permissions
    let permitted = false;
    if (roles.indexOf('manager') >= 0 && project.createdBy === currentUserId) {
      permitted = true;
    }
    if (roles.indexOf('client') >= 0 && project.clientId === currentUserId) {
      permitted = true;
    }

    if (!permitted) {
      throw new errors.ForbiddenError('You cannot download the submission. You must be a manager, ' +
        'or the client associated with the project. Or you are a client that do not associate with the project/challenge');
    }

    return {
      ipfsHash: challenge.ipfsHash,
      fileName: challenge.fileName
    };
  }



  /**
   * Gets the project and challenge instance from he challenge id.
   * @param stub the stub.
   * @param challengeId the challenge id.
   * @returns {Promise<{project: *, challenge: *}>} the project or the challenge.
   * @private
   */
  async __getProjectChallenge(stub, challengeId) {
    const projects = await this.listProjects(stub, null);
    let foundProject = null;
    let foundChallenge = null;
    _.forEach(projects, project => {
      _.forEach(project.challenges, challenge => {
        if (challenge.challengeId === challengeId) {
          foundChallenge = challenge;
          foundProject = project;
        }
      });
    });
    if (!foundChallenge) {
      throw new errors.BadRequestError('cannot find the challenge with id: ' + challengeId
        + '. Maybe this challenge is not completed yet.');
    }

    return {project: foundProject, challenge: foundChallenge};
  }



  /**
   * Lists all the projects.
   * @param stub the stubs
   * @param args should be empty.
   * @returns {Promise<Array>} all the review items.
   */
  async listProjects(stub, args) {
    const roles = checkRole(stub, ['client', 'manager']);
    let isClient = false;
    if (roles.length === 1 && roles[0] === 'client') {
      isClient = true;
    }
    let cid = new ClientIdentity(stub);
    const memberId = cid.getAttributeValue('userId');
    let iterator = await stub.getStateByRange("prj_", "prj_z");

    let allResults = [];
    while (true) {
      let res = await iterator.next();
      if (res.value && res.value.value.toString()) {
        try {
          const item = JSON.parse(res.value.value.toString('utf8'));
          if (isClient) {
            if (item.clientId === memberId) {
              allResults.push(item);
            }
          } else {
            allResults.push(item);
          }

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
   * Calculates the expense of the challenge.
   * @param challenge the challenge.
   * @returns {number} the number of the expense.
   * @private
   */
  __calculateExpense(challenge) {
    let sum = 0;
    sum += challenge.prizes.copilot;
    _.forEach(challenge.reviewers, reviewer => {
      sum += challenge.prizes.reviewer;
    });
    _.forEach(challenge.winners, winner => {
      sum += winner.prize;
    });
    return sum;
  }

  /**
   * Handles the actions when the challenge is completed.
   * @param stub the stub.
   * @param args the request.
   * @returns {Promise<void>}
   */
  async onChallengeCompleted(stub, args) {
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for challenge)');
    }
    const challenge = JSON.parse(args[0]);
    const projectId = challenge.projectId;
    const project = await this.__getProject(stub, projectId);
    const challenges = project.challenges || [];
    project.challenges = challenges;
    const item = {
      challengeId: challenge.challengeId,
      name: challenge.name,
      expense: this.__calculateExpense(challenge),
      startDate: challenge.phases[0].startDate,
      endDate: challenge.phases[challenge.phases.length - 1].endDate,
    };
    if (challenge.winners.length > 0) {
      item.ipfsHash = challenge.winners[0].submission.ipfsHash;
      item.fileName = challenge.winners[0].submission.fileName;
    }
    challenges.push(item);
    return await this.__saveProject(stub, project);
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
   * Gets the project key.
   * @param projectId the id of the project.
   * @returns {string} the project id.
   * @private
   */
  __getProjectKey(projectId) {
    return `prj_${projectId}`;
  }
};



module.exports = Chaincode;
