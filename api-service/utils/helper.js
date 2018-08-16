/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */


/**
 * This file defines helper methods.
 */
const _ = require('lodash');

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
module.exports = {
  autoWrapExpress,
  roleToOrganization
};
