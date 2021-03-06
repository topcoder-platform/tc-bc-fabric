/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This is the file for user service.
 *
 * @author TCSDEVELOPER
 * @version 1.0
 */
const config = require('config');
const crypto = require('crypto')
const Joi = require('joi');

const errors = require('../utils/errors');
const helper = require('../utils/helper');
const logger = require('../utils/logger');
const fabricService = require('./FabricService');

/**
 * Creates a user.
 * @param payload the user payload.
 * @returns {Promise<*>} the promise of the user.
 */
async function create(payload) {
  // validate the existence of the user
  let eUser = await getByEmail(payload.memberEmail);
  if (eUser) {
    throw new errors.ConflictError(`User with email ${payload.memberEmail} already exists.`);
  }
  eUser = await getById(payload.memberId);
  if (eUser) {
    throw new errors.ConflictError(`User with id ${payload.memberId} already exists.`);
  }

  const roles = payload.roles;
  // register to each ca
  const registeredOrs = {};
  for (let i = 0; i < roles.length; i++) {
    const org = helper.roleToOrganization(roles[i]);
    if (!org) {
      throw errors.BadRequestError(`unrecognized role: ${roles[i]}`);
    }
    if (registeredOrs[org]) {
      continue;
    }
    await __createUserToCA(org, payload);
    registeredOrs[org] = true;
  }

  // add user to blockchain
  await __createUserToBlockchain(payload);

  return payload;
}

/**
 * The schema for the create method.
 */
create.schema = {
  payload: Joi.object().keys({
    memberId: Joi.id(),
    memberEmail: Joi.emailId(),
    roles: Joi.array().items(Joi.roles().required()).required()
  })
};


/**
 * Gets the user by email.
 * @param email the email.
 * @returns {Promise<*>} the user by email.
 */
async function getByEmail(email) {
  const client = await fabricService.getClientForOrg('Topcoder');
  const channel = client.getChannel('topcoder-review');
  return await fabricService.queryByChaincode(client, channel, 'users', 'getUserByEmail', [email], true);
}

/**
 * Gets the user by id.
 * @param id the user id.
 * @returns {Promise<*>} the user
 */
async function getById(id) {
  const client = await fabricService.getClientForOrg('Topcoder');
  const channel = client.getChannel('topcoder-review');
  return await fabricService.queryByChaincode(client, channel, 'users', 'getUserById', [id], true);
}

/**
 * List the users.
 * @returns {Promise<*>} the result.
 */
async function list() {
  const client = await fabricService.getClientForOrg('Topcoder');
  const channel = client.getChannel('topcoder-review');
  return await fabricService.queryByChaincode(client, channel, 'users', 'listUsers', [], true);
}

/**
 * Enrolls a user to CA.
 * @param client the client.
 * @param username the username.
 * @param password the password.
 * @returns {Promise<*|Client.User>} the result.
 */
async function enroll(client, username, password) {
  const caService = client.getCertificateAuthority();

  let request = {
    enrollmentID: username,
    enrollmentSecret: password,
    profile: 'tls'
  };

  const enrollment = await caService.enroll(request);

  // register the user in local
  const options = {
    username: username,
    mspid: client.getMspid(),
    cryptoContent: {privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate}
  };

  return await client.createUser(options);

}

/**
 * Creates a user to ca.
 * @param organization the organization.
 * @param payload the payload.s
 * @returns {Promise<*|Client.User>} the result.
 * @private
 */
async function __createUserToCA(organization, payload) {
  // get the fabric-client and fabric-ca-client
  const client = await fabricService.getClientForOrg(organization);
  const caService = client.getCertificateAuthority();

  // get the admin
  const registrarConfig = caService.getRegistrar();
  if (!registrarConfig || registrarConfig.length === 0) {
    throw new Error('cannot get registrar from network configuration for organization: ' + organization);
  }
  const registrar = registrarConfig[0];
  let adminUser = await client.getUserContext(registrar.enrollId, true);
  if (adminUser === null) {
    console.log('cannot find the admin user at first time');
    adminUser = await client.setUserContext({username: registrar.enrollId, password: registrar.enrollSecret});
  }

  const username = payload.memberEmail;
  const userId = payload.memberId;
  const roles = payload.roles;

  let secret = getUserSecret(username);

  secret = await caService.register({
    enrollmentID: username,
    enrollmentSecret: secret,
    maxEnrollments: -1,
    affiliation: organization.toLowerCase(),
    role: 'client',
    attrs: [
      {name: 'roles', value: roles.join(','), ecert: true},
      {name: 'uerId', value: userId, ecert: true}
    ]
  }, adminUser);

  return await enroll(client, username, secret);

}

/**
 * Gets the secret from username.
 * @param username the username.
 * @returns {string} the secret.
 */
function getUserSecret(username) {
  const key = config.secretGenerateKey;
  return crypto.createHmac('sha1', key).update(username).digest('hex');
}

/**
 * Creates the user to blockchain.
 * @param payload the user payload.
 * @returns {Promise<void>} the result.
 * @private
 */
async function __createUserToBlockchain(payload) {

  const client = await fabricService.getClientForOrg('Topcoder');
  const channel = client.getChannel('topcoder-review');

  // invoke the chain code to commit the user to blockchain
  await fabricService.invokeChainCode(client, channel, 'users', 'createUser', [JSON.stringify(payload)], true);
}

/**
 * Validates the user and enroll it.
 * @param user the user.
 * @param permittedRoles the permitted roles.
 * @returns {Promise<*>} the result.
 * @private
 */
async function __validateUserAndEnroll(user, permittedRoles) {
  // validate the roles
  let permittedRole = null;
  for (let i = 0; i < permittedRoles.length; i++) {
    const role = permittedRoles[i];
    if (user.roles && user.roles.indexOf(role) >= 0) {
      permittedRole = role;
      break;
    }
  }

  if (!permittedRole) {
    throw new errors.ForbiddenError('Only these roles can perform this action: ' + JSON.stringify(permittedRoles));
  }

  const organization = helper.roleToOrganization(permittedRole);
  const client = await fabricService.getClientForOrg(organization);

  await enroll(client, user.memberEmail, getUserSecret(user.memberEmail));

  client.appUser = user;

  return client;
}

/**
 * Validates the user and enroll it via user email.
 * @param userEmail the user email.
 * @param permittedRoles the permitted role.
 * @returns {Promise<*>} the promise.
 */
async function validateUserAndEnroll(userEmail, permittedRoles) {
  const user = await getByEmail(userEmail);
  if (!user) {
    throw new errors.BadRequestError('cannot find user with email: ' + userEmail);
  }
  return await __validateUserAndEnroll(user, permittedRoles);
}

/**
 * The validate schema.
 */
validateUserAndEnroll.schema = {
  userEmail: Joi.emailId(),
  permittedRoles: Joi.array().items(Joi.roles()).required()
};

/**
 * Validates the user and enroll it via user id.
 * @param userId the user id.
 * @param permittedRoles the permitted role.
 * @returns {Promise<*>} the promise.
 */
async function validateUserAndEnrollById(userId, permittedRoles) {
  const user = await getById(userId);
  if (!user) {
    throw new errors.BadRequestError('cannot find user with id: ' + userId);
  }
  return await __validateUserAndEnroll(user, permittedRoles);
}

/**
 * the validate schema.
 */
validateUserAndEnrollById.schema = {
  userId: Joi.id(),
  permittedRoles: Joi.array().items(Joi.roles()).required()
};

module.exports = {
  validateUserAndEnroll,
  validateUserAndEnrollById,
  create,
  list
};

logger.buildService(module.exports);