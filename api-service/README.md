# Topcoder - PoC Challenge Review Process with Blockchain - Rest API Setup

This is the deployment guide for PoC Challenge Review Process with Blockchain - Rest API Setup

## Prerequisites

1. Mac OSX or Linux
2. [Node.js v8.9.0 - v9.0](https://nodejs.org/en/blog/release/v8.9.0/)

    _*IMPORTANT NOTE:*_ The [fabric node sdk](https://github.com/hyperledger/fabric-sdk-node) mentioned that:
    > node runtime LTS version 8.9.0 or higher, up to 9.0 ( Node v9.0+ is not supported )

    So, you must use the node.js version v8.9.0 - v9.0 to run this api. (Otherwise, there will be some SSL Handshake errors).
    I am using v8.9.0. You can use `nvm` to manage the node versions.

3. [Hyperledger Fabric](https://www.hyperledger.org/projects/fabric)

    Read the blockchain [README.md](../blockchain/README.md) to setup the fabric network.

    Make sure the Fabric blockchain netowork has been setup before setting up this API.

## Configuration

In this challenge, you can use the default configuration in the submission to setup and tests without touching any configurations.
So you can skip the whole `configuration` section if you don't want to spend much time to read.

### Rest API Configurations

The app's configuration is in: [./config/default.js](./config/default.js)

- PORT - the listening port of this api
- logLevel - the logging level
- version - the api version to construct the entrypoint of the api, like: /api/${version}
- secretGenerateKey - the private key to generate the hash secret to enroll to CA.

Also, some of the configurations can be set via environment variables, see:
[./config/default.js](./config/custom-environment-variables.js)


### Fabric Network Configurations

The fabric configurations are in folder: `./config/fabric`.

- network.yaml - this is the configurations for all the peers, CAs, orderers.
- \<ORGANIZATION\>.yaml - for each organization, it has its own configurations.
- crypto-config - this folder is copied from blockchain/crypto-config (generated by ./topcoder-review.sh generate command)

## Build and Run

Install the dependecies, run:
```
npm install
```

Copy the blockchain's certificates, run:
```
./copy-certs.sh
```
This script will copy the certificates from `../blockchain/crypto-config` by default. (this folder is generated by `topcoder-review.sh up`)*[]:

If your certificates is not in that path, run:
```
./copy-certs.sh <PATH_TO_CRYPTO_CONFIG_FOLDER>
```

after running the `./copy-certs.sh` command, the certificates should be copied to `./config/fabric/crypto-config` folder.


To serve the api, run:
```
npm start
```

The api entry point now should be:
```
http://localhost:3010/api/v1
```

## Verification
View [Validation.md](./Validation.md) for details.



