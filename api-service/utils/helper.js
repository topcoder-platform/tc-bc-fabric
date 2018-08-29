/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */


/**
 * This file defines helper methods.
 */
const fs = require('fs');
const config = require('config');
const _ = require('lodash');
const ipfsAPI = require('ipfs-api');
const ipfs = ipfsAPI(config.ipfs);

/**
 * Wrap generator function to standard express function.
 * @param {Function} fn the generator function
 * @returns {Function} the wrapped function
 */
function wrapExpress(fn) {
  return function wrapGenerator(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Wrap all generators from object.
 * @param obj the object (controller exports)
 * @returns {Object|Array} the wrapped object
 */
function autoWrapExpress(obj) {
  if (_.isArray(obj)) {
    return obj.map(autoWrapExpress);
  }
  if (_.isFunction(obj)) {
    if (obj.constructor.name === 'AsyncFunction') {
      return wrapExpress(obj);
    }
    return obj;
  }
  _.each(obj, (value, key) => {
    obj[key] = autoWrapExpress(value);
  });
  return obj;
}


/**
 * Converts the roles to the organization names.
 * @param role the role
 * @returns {*} the organization
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
 * Adds a file to ipfs.
 * @param filePath the file path of the local file system.
 * @returns {Promise<any>} the added file entity.
 */
function ipfsAdd(filePath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    ipfs.files.add([{path: '/submissions', content: stream}], (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res[0]);
      }
    });
  });
}

/**
 * Gets a file from ipfs.
 * @param fileHash the hash of the file.
 * @returns {Promise<any>} the file entity.
 */
function ipfsGet(fileHash) {
  return new Promise((resolve, reject) => {
    ipfs.files.get(fileHash, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res[0]);
      }
    })
  });
}

module.exports = {
  autoWrapExpress,
  roleToOrganization,
  ipfsAdd,
  ipfsGet
};
