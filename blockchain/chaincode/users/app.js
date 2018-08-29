/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

'use strict';
const shim = require('fabric-shim');
const _ = require('lodash');
const errors = require('./errors');

/**
 * This is the class for users chaincode.
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
    console.info('=========== Instantiated users chaincode ===========');
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

    let method = this[ret.fcn];
    if (!method) {
      console.error('no function of name:' + ret.fcn + ' found');
      throw new errors.BadRequestError('Received unknown function ' + ret.fcn + ' invocation');
    }
    method = method.bind(this);
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
   * Creates a user.
   * @param stub the stub.
   * @param args the args: the user payload.
   * @returns {Promise<*>} the user item.
   */
  async createUser(stub, args) {
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for payload)');
    }

    const payload = JSON.parse(args[0]);
    if (!payload.memberId || !payload.memberEmail) {
      throw new errors.ValidationError('memberId and memberEmail are required');
    }

    const userIdKey = `usr_id_${payload.memberId}`;
    const userEmailKey = `usr_email_${payload.memberEmail}`;

    await stub.putState(userIdKey, Buffer.from(JSON.stringify(payload)));
    await stub.putState(userEmailKey, Buffer.from(JSON.stringify(payload)));

    return payload;
  }

  /**
   * Gets the user by email.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<*>} the promise of the user.
   */
  async getUserByEmail(stub, args) {
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for email)');
    }
    const email = args[0];
    const value = await stub.getState(`usr_email_${email}`);
    if (!value || value.toString().length <= 0) {
      return null;
    }
    return JSON.parse(value.toString());
  }

  /**
   * Gets the user by id.
   * @param stub the stub.
   * @param args the arguments.
   * @returns {Promise<*>} the promise of the user.
   */
  async getUserById(stub, args) {
    if (args.length !== 1) {
      throw new errors.BadRequestError('Incorrect number of arguments. Expecting 1 (for id)');
    }
    const userId = args[0];
    const value = await stub.getState(`usr_id_${userId}`);
    if (!value || value.toString().length <= 0) {
      return null;
    }
    return JSON.parse(value.toString());
  }

  /**
   * Lists all the users.
   * @param stub the stubs
   * @param args should be empty.
   * @returns {Promise<Array>} all the review items.
   */
  async listUsers(stub, args) {
    let iterator = await stub.getStateByRange("usr_id_", "usr_id_z");

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
};

module.exports = Chaincode;
