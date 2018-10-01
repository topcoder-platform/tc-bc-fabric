# Topcoder - PoC Challenge Review Process with Blockchain - Setup

This is the validation document for PoC Challenge Review Process with Blockchain - Setup

## Start/Stop network verification.

As the [README.md](./README.md) says, to start the network, simply run:
```
./topcoder-review.sh up
```

to verify the network is running, you can use:
```
docker ps
```
You should see all the peer nodes, the cli container, and the IPFS are all running.

to stop the network, run:
```
./topcoder-review.sh down
```
Then, run:
```
docker ps
```
you can see that all the above containers have been cleaned up.

## Manual Command Line Verification

_NOTE, actually I have provided some scripts to verify the submission, so you don't have to manually call the command line, so you can go to read the [Script Verificaton](#script-verification) section directly._

All the peer commands you execute on the `cli` container. So in your local machine, you can run the peer command in this format:

```
docker exec cli <YOUR_PEER_COMMAND_HERE>
```
For example, to query the users chaincode items, you can run:

```
docker exec cli peer chaincode query -C topcoder-review -n projects -c '{"Args":["listReviews"]}'
```

#### Change the selected peer

By default, the cli communicates the peer0.topcoder.topcoder.com peer. If you want to change the peer, you have to set the following environments in the `cli` docker container (NOT your local machine):
```
CORE_PEER_LOCALMSPID=TopcoderMSP
CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/topcoder.topcoder.com/peers/peer0.topcoder.topcoder.com/tls/ca.crt
CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/topcoder.topcoder.com/peers/peer0.topcoder.topcoder.com/tls/server.key
CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/topcoder.topcoder.com/peers/peer0.topcoder.topcoder.com/tls/server.crt
CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/topcoder.topcoder.com/users/Admin@topcoder.topcoder.com/msp
CORE_PEER_ADDRESS=peer0.topcoder.topcoder.com:7051
```

I provided a helper script to do it for you: `tests/pick-peer.sh`. You just need to change the `ORGANIZATION`, `ORGANIZATION_DOMAIN` and `PEER_HOST` configurations in that script,
and modify the peer command in that script, then run:

```
docker exec cli ./tests/pick-peer.sh <YOUR_PEER_COMMAND_HERE>
```

This `pick-peer.sh` script will help you to set the environment variables and select the correct peer.
For example:
```
docker exec cli ./tests/pick-peer.sh peer chaincode query -C topcoder-client -n topcoder-client -c '{"Args":["listProjects"]}'
```

#### Often Used Commands

**Install and initialize chaincode**

_NOTE: All the chaincodes have been installed and instantiated in `scripts/install.sh` when you run `./topcoder-review.sh up`. So you don't need to run the following command manully._

To install the chaincode:
```
docker exec cli peer chaincode install -n users -v 1.0.0 -l node -p /opt/gopath/src/github.com/chaincode/topcoder-review
```
To instantiate in a channel.
```
docker exec cli peer chaincode instantiate -o orderer.topcoder.com:7050 --tls true --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/topcoder.com/orderers/orderer.topcoder.com/msp/tlscacerts/tlsca.topcoder.com-cert.pem -C topcoder-review -n users -l projects -v 1.0.0 -c '{"Args":[]}'
```

For more details for the chaincode commands, read: https://hyperledger-fabric.readthedocs.io/en/release-1.2/commands/peerchaincode.html

**Store data from blockchain**

The following command use the chaincode `topcoder-review` to create a review item and store it in blockchain.

```
docker exec cli peer chaincode invoke -o orderer.topcoder.com:7050 --tls true --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/topcoder.com/orderers/orderer.topcoder.com/msp/tlscacerts/tlsca.topcoder.com-cert.pem -C topcoder-review -n projects --peerAddresses peer0.topcoder.topcoder.com:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/topcoder.topcoder.com/peers/peer0.topcoder.topcoder.com/tls/ca.crt -c '{"Args":["createReview","rXf4xJOTJh"]}'
```

**Retrieve data from blockchain**

The following command use the chaincode `topcoder-review` to retrieve all the review items in blockchain.
```
docker exec cli peer chaincode query -C topcoder-review -n topcoder-review -c '{"Args":["listReviews"]}'
```

**IPFS Verification**

In `cli`, you can use the IPFS web API to upload the file:

```
docker exec cli curl -s http://ipfs-node:5001/api/v0/add -F file=@./tests/test_files/hello_world.txt
```
Or the api to get the file:
```
docker exec cli curl -s http://ipfs-node:5001/api/v0/cat/<FILE_HASH>
```


## Script Verification

I provided 2 scripts for execute the often used peer commands. One is `./scripts/install.sh` and another is `./tests/tests.sh`.

#### ./scripts/install.sh
This script is automatically invoked when you run `./topcoder-review.sh up`. So you don't have to manually call it.
This script to the following things:

- create the channels: topcoder-review, topcoder-client
- let the peers join the channels
- install the chaincode `topcoder-client` and intantiates it.
- install the chaincode `topcoder-review` and intantiates it.

If you want to manually run some of the commands, you can run:
```
./topcoder-review.sh up -v
```
The peer commands it calls and the global env variables will print to the console, and you can copy the commands and manually run it.

#### ./tests/tests.sh

This script will test the chaincode `topcoder-client` and `topcoder-review`.
To run these tests, run:
```
docker exec cli ./tests/tests.sh
```
This script also demonstrates uploading a file to IPFS, and then save the file hash to the blockchain.

The actual commands it runs will print to console, if you want to run it manually, you can just copy it.
