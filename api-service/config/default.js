/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file is the configurations of the rest-api application.
 * @author TCSDEVELOPER
 * @version 1.0
 */
module.exports = {
  port: 3010,
  logLevel: "debug",
  version: "v1",
  jwtSecret: 'mysecret',
  secretGenerateKey: 'FabricT0pC0der',
  fileUploadTMPDirectory: '/tmp/topcoder-upload',
  tokenExpires: 86400 * 365, // 365 days
  phaseCheckInterval: 10, // every 10 seconds
  ipfs: {
    host: 'localhost',
    port: '5001',
    protocol: 'http'
  }
};
