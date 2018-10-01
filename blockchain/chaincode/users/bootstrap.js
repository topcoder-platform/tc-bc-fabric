/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file is the bootstrap of the chaincode.
 */

'use strict';
const shim = require('fabric-shim');

const Chaincode = require('./app');
shim.start(new Chaincode());
