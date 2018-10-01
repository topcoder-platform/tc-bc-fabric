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
  '/login': {
    post: {
      controller: 'UserController', method: 'login'
    },
  },


  '/projects': {
    post: {
      controller: 'ProjectController', method: 'create', auth: ['manager', 'client']
    },
    get: {
      controller: 'ProjectController', method: 'list', auth: ['manager', 'client']
    },
  },
  '/projects/:projectId': {
    put: {
      controller: 'ProjectController', method: 'update', auth: ['manager']
    },
    get: {
      controller: 'ProjectController', method: 'get', auth: ['manager']
    }
  },


  '/challenges': {
    post: {
      controller: 'ChallengeController', method: 'create', auth: ['copilot']
    },
    get: {
      controller: 'ChallengeController', method: 'list'
    }
  },
  '/challenges/:challengeId': {
    put: {
      controller: 'ChallengeController', method: 'update', auth: ['copilot']
    },
    get: {
      controller: 'ChallengeController', method: 'get'
    }
  },
  '/challenges/:challengeId/register': {
    post: {
      controller: 'ChallengeController', method: 'registerChallenge', auth: ['member']
    },
    delete: {
      controller: 'ChallengeController', method: 'unregisterChallenge', auth: ['member']
    },
  },
  '/challenges/:challengeId/reviewer/:userId': {
    post: {
      controller: 'ChallengeController', method: 'registerReviewer', auth: ['copilot']
    },
    delete: {
      controller: 'ChallengeController', method: 'unregisterReviewer', auth: ['copilot']
    },
  },



  '/challenges/:challengeId/submissions': {
    post: {
      controller: 'ChallengeController', method: 'uploadSubmission', auth: ['member']
    }
  },
  '/challenges/:challengeId/submissions/:submissionId': {
    get: {
      controller: 'ChallengeController', method: 'downloadSubmission', auth: ['member', 'manager', 'copilot']
    }
  },

  '/challenges/:challengeId/winning-submission': {
    get: {
      controller: 'ChallengeController', method: 'downloadWinningSubmission', auth: ['client']
    }
  },
  '/challenges/:challengeId/scorecard': {
    post: {
      controller: 'ChallengeController', method: 'createScorecard', auth: ['manager', 'copilot']
    }
  },
  '/challenges/:challengeId/review': {
    post: {
      controller: 'ChallengeController', method: 'createChallengeReview', auth: ['reviewer']
    }
  },
  '/challenges/:challengeId/appeals': {
    post: {
      controller: 'ChallengeController', method: 'createAppeal', auth: ['member']
    }
  },
  '/challenges/:challengeId/appealResponse': {
    post: {
      controller: 'ChallengeController', method: 'createAppealResponse', auth: ['reviewer']
    }
  }
};