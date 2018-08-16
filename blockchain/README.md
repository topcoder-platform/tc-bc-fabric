# Topcoder - PoC Challenge Review Process with Blockchain - Setup

This is the deployment guide for PoC Challenge Review Process with Blockchain - Setup

## Prerequisites

1. Mac OSX or Linux
2. [Docker](https://www.docker.com/)
3. [Node.js v8+](https://nodejs.org/en/)
4. [Hyperledger Fabric](https://www.hyperledger.org/projects/fabric)
5. [IPFS](https://ipfs.io/)

Note, all you need to do is just install and run docker in your local machine (Linux or Mac OSX).
Other prerequisites will be installed or running in docker containers.

## Configuration

In this challenge, you can use the default configuration in the submission to setup and tests without touching any configurations.
So you can skip the whole `configuration` section if you don't want to spend much time to read.

### Docker containers configuration

The docker containers configuration is file: `docker-compose-cli.yaml`

This file defines several docker containers:

- orderer.topcoder.com - the solo order service for the fabric network
- peer0.topcoder.topcoder.com - the 1st peer in topcoder organization
- peer1.topcoder.topcoder.com - the 2nd peer in topcoder organization
- peer0.clients.topcoder.com - the 1st peer in clients organization
- peer1.clients.topcoder.com - the 2nd peer in clients organization
- peer0.members.topcoder.com - the 1st peer in members organization
- peer1.members.topcoder.com - the 2nd peer in members organization
- peer0.moderators.topcoder.com - the 1st peer in moderators organization
- peer1.moderators.topcoder.com - the 2nd peer in moderators organization
- cli - the client for communicate with the peers and execute peer commands
- ipfs-node - the ipfs service

### crypto-config.yaml

The `crypto-config.yaml` is used in the `cryptogen` command to generate peer artifacts.
It contains the network topology and allows us to generate a set of certificates and keys for both the Organizations and the components that belong to those Organizations.

### configtx.yaml

The file `configtx.yaml` contains the definitions for the topcoder-review network.
It defines 4 organizations (Topcoder, Clients, Members, Moderators) and the 2 channels: topcoder-client, and topcoder-review

This file will be used in  `cryptogen` command.


### Script configuration

There are some configuration for running the scripts. It is in `scripts/config.sh`

- MAIN_DOMAIN - the main domain
- ORDERER_DOMAIN - the domain for the orderer
- ORDERER_HOST - the host for the orderer
- ORDERER_ADDRESS - the orderer service address
- IPFS_API_ENTRYPOINT - the IPFS api entry point
- DELAY - the delay for executing the scripts
- TIMEOUT - the timeout for executing the scripts
- MAX_RETRY - the max retry for the script commands
- VERBOSE - verbose or not

## Download Prerequisites

We need to download the docker images for Hyperledger Fabric and IPFS, also we also need to download the Fabric binaries to your local machine.
One single command will do all for you:
```
./download.sh
```

After this command successfully executed, run `docker images`, you can see some Fabric images are pulled, and th IPFS image (jbenet/go-ipfs) is pulled too.

Also the Fabric binaries are downloaded in `./bin`


## Start/Stop the topcoder-review network

The script: `topcoder-review.sh` is used to manager the fabric network. Try to run the following commands:
```
./topcoder-review.sh generate
```
> This command generates the channel artifacts and store the generated data in `channel-artifacts` folder.
Also it will generate the crypto-config (certificates) and stored the generated data in `crypto-config` folder.


```
./topcoder-review.sh up
```
> This command do the following things for you:
1). start the docker containers for: cli, 8 peers (2 peer for each organizations), and the IPFS.
2). Create the 2 channels (topcoder-review, topcoder-client)
3). All the peers in organziation: Topcoder, Clients, join the channel topcoder-client.
4). All the peers in organization: Topcoder, Members, Moderators join the channel topcoder-review.
5). Install the chaincode `topcoder-review` to the channel `topcoder-review`
6). Install the chaincode `topcoder-client` to the channel `topcoder-client`
7). Instantiates these 2 chaincodes.
Note, you can view the `./scripts/install.sh` to see the above steps.

```
./topcoder-review.sh down
```
> This command do the following things for you:
1). Stops all the related docker containers.
2). Clear the auto-generated data in your local machine.

```
./topcoder-review.sh restart
```
> Basically, this is a shortcut for `./topcoder-review.sh down` then `./topcoder-review.sh up`

## Start/Stop the Fabric-ca

To start the Fabric-ca, run:
```
./fabric-ca.sh up
```

This command will start the dockers for fabric-ca servers (each organization has a Fabric-ca).

To stop the Fabric-ca, run:
```
./fabric-ca.sh down
```

This command will shutdown all the fabric-ca servers.


## Conclusion

To conclude, to start the whole service, you just need to run the following commands:
```
./download.sh
./topcoder-review.sh generate
./topcoder-review.sh up
./fabric-ca.sh up
```

## Verification
View [Validation.md](./Validation.md) for details.

## KNOWN ISSUES

1). Instantiates a chaincode could be very slow (because the Fabric will try to pull and chaincode container image):
```
peer chaincode instantiate ...
```
be patient to wait this command stopped. If you got a timeout response, you can restart the network and retry.
If still failed to you, update the following env variables in the `base/peer-base.yaml` file:
```
      - CORE_CHAINCODE_DEPLOYTIMEOUT=1800s
      - CORE_CHAINCODE_STARTUPTIMEOUT=1800s
```

2). If you run the chaincode query command immediately after the chaincode invoke command, you many not query the new mutated data.
Because the chaincode invoke need sometime to commit to the blockchain. So, you'd better wait several seconds after you run the chaincode invoke command.