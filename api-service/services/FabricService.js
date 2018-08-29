/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This is the file for fabric service.
 *
 * @author TCSDEVELOPER
 * @version 1.0
 */

const path = require('path');
const Client = require('fabric-client');

const clientOrganizationMappings = {};

/**
 * Gets the client from organization name.
 * @param org the name of the organization.
 * @returns {Promise<*>} the result.
 */
async function getClientForOrg(org) {
  // read from cache
  if (clientOrganizationMappings[org]) {
    return clientOrganizationMappings[org];
  }

  const fabricConfigPath = path.join(__dirname, '..', 'config', 'fabric');

  // load the network configurations
  const client = Client.loadFromConfig(path.join(fabricConfigPath, 'network.yaml'));

  // load the client information for this organization
  // this file only has the client section
  client.loadFromConfig(path.join(fabricConfigPath, `${org}.yaml`));


  // tell this client instance where the state and key stores are located
  await client.initCredentialStores();

  // enroll the admin
  await enrollAdmin(client);

  // add it to cache
  clientOrganizationMappings[org] = client;

  return client;
}

/**
 * Enrolls the admin.
 * @param client the client.
 * @returns {Promise<void>} the result.
 */
async function enrollAdmin(client) {

  const caService = client.getCertificateAuthority();

  // get the admin
  const registrarConfig = caService.getRegistrar();
  if (!registrarConfig || registrarConfig.length === 0) {
    // no admin found
    return;
  }

  const registrar = registrarConfig[0];

  let request = {
    enrollmentID: registrar.enrollId,
    enrollmentSecret: registrar.enrollSecret,
    profile: 'tls'
  };

  const enrollment = await caService.enroll(request);

  client.setAdminSigningIdentity(enrollment.key.toBytes(), enrollment.certificate, client.getMspid());

  const options = {
    username: registrar.enrollId,
    mspid: client.getMspid(),
    cryptoContent: {privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate}
  };

  await client.createUser(options);
}

const convertErrorMessage = (err) => {
  let message = err.message;
  let status = 500;
  if (message) {
    const t = message.indexOf('transaction returned with failure: Error: ');
    if (t >= 0) {
      message = message.substring(t + 'transaction returned with failure: Error: '.length);
    }
  }
  const extractRegex = /status: (.*) message: (.*)/g;
  const result = extractRegex.exec(message);
  if (result && result.length > 2) {
    status = parseInt(result[1]);
    message = result[2];
  }
  const newError = new Error(message);
  newError.status = status;
  return newError;
};

/**
 * Invokes the chaincode.
 * @param client the client.
 * @param channel the channel.
 * @param chaincode the chaincode.
 * @param fcn the function.
 * @param args the arguments.
 * @param useAdmin use admin or not.
 * @returns {Promise<string>} the result.
 */
async function invokeChainCode(client, channel, chaincode, fcn, args, useAdmin) {
  // auto find the endorsers of the organization
  const targetPeers = channel.getChannelPeers().filter(p => p.isInRole("endorsingPeer")
    && p.isInOrg(client.getMspid()));

  const targets = targetPeers.map(p => p.getName());
  console.log(targets);
  if (targetPeers.length === 0) {
    throw new Error('cannot find any endorser for channel: '
      + channel.getName() + ' may be there is a configuration issue.');
  }

  const txId = client.newTransactionID(useAdmin);

  // send proposal to endorser
  const request = {
    targets,
    chaincodeId: chaincode,
    fcn,
    args,
    txId
  };


  const results = await channel.sendTransactionProposal(request);


  const proposalResponses = results[0];
  const proposal = results[1];
  let allGood = true;
  let errorPr = null;
  proposalResponses.forEach((pr) => {
    let oneGood = false;
    if (pr.response && pr.response.status === 200) {
      oneGood = true;
    } else if (pr instanceof Error) {
      errorPr = pr;
    }
    allGood = allGood && oneGood;
  });

  if (!allGood && errorPr) {
    throw convertErrorMessage(errorPr);
  } else if (!allGood) {
    throw new Error('no endorsers or some are not property connect');
  }


  const request2 = {
    proposalResponses,
    proposal,
    txId
  };

  const transactionID = txId.getTransactionID();
  const eventPromises = [];

  const eventhubs = targetPeers.map(p => {
    return channel.newChannelEventHub(p);
  });

  eventhubs.forEach(eh => {
    eh.connect();

    const txPromise = new Promise((resolve, reject) => {
      const handle = setTimeout(() => {
        eh.disconnect();
        reject();
      }, 30000);

      eh.registerTxEvent(transactionID, (tx, code) => {
        clearTimeout(handle);
        eh.unregisterTxEvent(transactionID);
        eh.disconnect();

        if (code !== 'VALID') {
          reject();
        } else {
          resolve();
        }
      });
    });

    eventPromises.push(txPromise);
  });

  const sendPromise = channel.sendTransaction(request2);
  const results2 = await Promise.all([sendPromise].concat(eventPromises));

  if (results2[0].status === 'SUCCESS') {
    return txId.getTransactionID();
  } else {
    throw new Error('Failed to order the transaction. Error code: ' + results2[0].status);
  }
}

/**
 * Queries the chaincode.
 * @param client the client.
 * @param channel the channel.
 * @param chaincode the chaincode.
 * @param fcn the function.
 * @param args the arguments.
 * @param useAdmin use admin or not.
 * @returns {Promise<*>} the result.
 */
async function queryByChaincode(client, channel, chaincode, fcn, args, useAdmin) {
  // auto find the endorsers of the organization
  const targetPeers = channel.getChannelPeers().filter(p => p.isInRole("chaincodeQuery")
    && p.isInOrg(client.getMspid()));

  const targets = targetPeers.map(p => p.getName());

  if (targetPeers.length === 0) {
    throw new Error('cannot find any peers to query chaincode for channel: '
      + channel.getName() + ' may be there is a configuration issue.');
  }


  const request = {
    targets,
    chaincodeId: chaincode,
    fcn,
    args
  };

  const result = await channel.queryByChaincode(request, useAdmin);

  if (result.length === 0) {
    throw new Error('query by chain code must return at least one item');
  }
  if (result[0] instanceof Error) {
    throw convertErrorMessage(result[0]);
  }
  const item = result[0].toString();
  if (!item) {
    return null;
  }
  return JSON.parse(item);
}


module.exports = {
  getClientForOrg,
  invokeChainCode,
  queryByChaincode
};