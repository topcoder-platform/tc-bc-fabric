/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the routers.
 *
 * @author TCSDEVELOPER
 * @version 1.0
 */
module.exports = {
  '/users': {
    post: {
      controller: 'UserController', method: 'create'
    },
    get: {
      controller: 'UserController', method: 'list'
    }
  },
  '/projects': {
    post: {
      controller: 'ProjectController', method: 'create'
    },
    get: {
      controller: 'ProjectController', method: 'list'
    },
  },
  '/projects/:projectId': {
    put: {
      controller: 'ProjectController', method: 'update'
    },
    get: {
      controller: 'ProjectController', method: 'get'
    }
  },
  '/challenges': {
    post: {
      controller: 'ChallengeController', method: 'create'
    }
  },
  '/challenges/:challengeId': {
    put: {
      controller: 'ChallengeController', method: 'update'
    }
  },

  '/challenges/:challengeId/submissions': {
    post: {
      controller: 'ChallengeController', method: 'uploadSubmission'
    }
  },

  '/challenges/:challengeId/submissions/:submissionId': {
    get: {
      controller: 'ChallengeController', method: 'downloadSubmission'
    }
  },

  '/register': {
    post: {
      controller: 'ChallengeController', method: 'registerChallenge'
    },
    delete: {
      controller: 'ChallengeController', method: 'unregisterChallenge'
    }
  }

};