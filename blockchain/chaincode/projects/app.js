/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

'use strict';
const shim = require('fabric-shim');
const _ = require('lodash');

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
 * @returns {boolean} true if correct, otherwise throws exception.
 */
const checkRole = (stub, permittedRoles) => {
  let cid = new ClientIdentity(stub);

  // get the role by Attributed Base Access Control
  let rolesABA = cid.getAttributeValue('roles');
  if (!rolesABA) {
    rolesABA = 'admin';
  }

  const roles = rolesABA.split(',');
  if (roles.indexOf('admin') >= 0) {
    // we always allow admin access
    return true;
  }

  console.log('operator roles: ' + rolesABA + ' msp: ' + cid.getMSPID());

  const validRoles = [];
  for (let role of roles) {
    if (permittedRoles.indexOf(role) >= 0) {
      validRoles.push(role);
    }
  }

  if (validRoles.length === 0) {
    throw new Error('Access denied. Only these roles can perform this operation: ' + permittedRoles.join(','));
  }

  // validate the MSPID
  let ok = false;
  for (let role of validRoles) {
    const org = roleToOrganization(role);
    if (org === null) {
      throw new Error('Access denied. Cannot recognize role: ' + role);
    }
    if (cid.getMSPID() === `${org}MSP`) {
      ok = true;
    }
  }
  if (!ok) {
    throw new Error('Access denied. The request is not submitted from a correct organization peer.');
  }

  return true;
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
      throw new Error('Received unknown function ' + ret.fcn + ' invocation');
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
      throw new Error('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    if (!payload.projectId) {
      throw new Error('projectId is required');
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
      throw new Error('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    if (!payload.projectId) {
      throw new Error('projectId is required');
    }
    if (!payload.updatedBy) {
      throw new Error('updatedBy is required');
    }

    const eProject = await this.__getProject(stub, payload.projectId);
    if (eProject === null) {
      throw new Error('cannot find project with id: ' + payload.projectId);
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
      throw new Error('Incorrect number of arguments. Expecting 1 (for email)');
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
      throw new Error('Incorrect number of arguments. Expecting 1 (for challenge payload)');
    }
    const challenge = JSON.parse(args[0]);
    if (!challenge.projectId) {
      throw new Error('projectId is required');
    }
    if (!challenge.challengeId) {
      throw new Error('challengeId is required');
    }

    const eChallenge = await this.__getChallenge(stub, challenge.challengeId);
    if (eChallenge) {
      throw new Error('challenge with id ' + challenge.challengeId + ' already exists');
    }

    const project = await this.__getProject(stub, challenge.projectId);
    if (!project) {
      throw new Error('cannot find project with id: ' + challenge.projectId);
    }

    const challenges = project.challenges || [];

    for (let c of challenges) {
      if (c.challengeId === challenge.challengeId) {
        throw new Error('the challenge with id: ' + c.challengeId + ' already created in this project');
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
      throw new Error('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const payload = JSON.parse(args[0]);
    if (!payload.challengeId) {
      throw new Error('challengeId is required');
    }

    const challenge = await this.__getChallenge(stub, payload.challengeId);
    if (!challenge) {
      throw new Error('challenge does not exists with id: ' + payload.challengeId);
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
      throw new Error('cannot find project with id: ' + challenge.projectId);
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
      throw new Error('cannot find challenge: ' + challenge.challengeId + ' from project: ' + project.projectId);
    }

    project.challenges = challenge;

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
      throw new Error('Incorrect number of arguments. Expecting 1 (for payload)');
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
      throw new Error('Incorrect number of arguments. Expecting 1 (for payload)');
    }
    const member = JSON.parse(args[0]);

    return await this.__updateMember(stub, member, 0);
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
      throw new Error('memberId is required');
    }
    if (!member.projectId) {
      throw new Error('projectId is required');
    }
    if (!member.challengeId) {
      throw new Error('challengeId is required');
    }
    const project = await this.__getProject(stub, member.projectId);
    if (!project) {
      throw new Error('cannot find project with id: ' + member.projectId);
    }
    let foundChallenge = null;
    project.challenges = project.challenges || [];
    for (let i = 0; i < project.challenges.length; i++) {
      const challenge = project.challenges[i];
      if (challenge.challengeId === member.challengeId) {
        foundChallenge = challenge;
        break;
      }
    }
    if (!foundChallenge) {
      throw new Error('cannot find challenge with id: ' + member.challengeId + ' in the given project');
    }
    // check if the member exists
    foundChallenge.members = foundChallenge.members || [];
    let found = false;
    for (let i = 0; i < foundChallenge.members.length; i++) {
      const m = foundChallenge.members[i];
      if (member.memberId === m.memberId) {
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

shim.start(new Chaincode());
