#!/bin/bash

#
# Copyright (c) 2018 TopCoder, Inc. All rights reserved.
#
# author: TCSDEVELOPER
# version: 1.0
#

#######################
# This is an install script to create channels, join channels and install/instantiate chaincode.
#######################

# import utils
. scripts/utils.sh

CHAIN_CODE_VERSION=1.0.0

echo
echo "  _____ _   _  _____ _______       _      _      _____ _   _  _____  "
echo " |_   _| \ | |/ ____|__   __|/\   | |    | |    |_   _| \ | |/ ____| "
echo "   | | |  \| | (___    | |  /  \  | |    | |      | | |  \| | |  __  "
echo "   | | | .   |\___ \   | | / /\ \ | |    | |      | | | .   | | |_ | "
echo "  _| |_| |\  |____) |  | |/ ____ \| |____| |____ _| |_| |\  | |__| | "
echo " |_____|_| \_|_____/   |_/_/    \_\______|______|_____|_| \_|\_____| "
echo
echo " Installing the topcoder-review Fabric network ..."

if [ "$1" != "" ]; then
    DELAY="$1"
fi

if [ "$2" != "" ]; then
    TIMEOUT="$2"
fi

if [ "$3" != "" ];then
    VERBOSE="$3"
fi


## Create channel
echo "Creating channel..."
createChannel "topcoder-client"
createChannel "topcoder-review"

## Join all the peers to the channel
echo "Having all peers join the channel: topcoder-client..."
joinChannel topcoder-client Topcoder 0
joinChannel topcoder-client Topcoder 1

joinChannel topcoder-client Clients 0
joinChannel topcoder-client Clients 1

echo "Having all peers join the channel: topcoder-review..."
joinChannel topcoder-review Topcoder 0
joinChannel topcoder-review Topcoder 1

joinChannel topcoder-review Members 0
joinChannel topcoder-review Members 1

joinChannel topcoder-review Moderators 0
joinChannel topcoder-review Moderators 1

## Install chaincode: users on peer0.Topcoder
echo "Installing chaincode: topcoder-review on peer0.Topcoder..."
installChaincode users Topcoder 0 $CHAIN_CODE_VERSION

## Instantiate chaincode: users on peer0.Topcoder
echo "Instantiating chaincode: users on peer0.Topcoder..."
instantiateChaincode topcoder-review users Topcoder 0 $CHAIN_CODE_VERSION


## Install chaincode: projects on peer0.Topcoder
echo "Installing chaincode: projects on peer0.Topcoder..."
installChaincode projects Topcoder 0 $CHAIN_CODE_VERSION

echo "Installing chaincode: projects on peer0.Clients..."
installChaincode projects Clients 0 $CHAIN_CODE_VERSION

echo "Installing chaincode: projects on peer0.Members..."
installChaincode projects Members 0 $CHAIN_CODE_VERSION

echo "Installing chaincode: projects on peer0.Moderators..."
installChaincode projects Moderators 0 $CHAIN_CODE_VERSION

## Instantiate chaincode: projects on peer0.Topcoder
echo "Instantiating chaincode: users on peer0.Topcoder..."
instantiateChaincode topcoder-client projects Topcoder 0 $CHAIN_CODE_VERSION
instantiateChaincode topcoder-client projects Clients 0 $CHAIN_CODE_VERSION

## Instantiate chaincode: projects on peer0.Topcoder
echo "Instantiating chaincode: users on peer0.Topcoder..."
instantiateChaincode topcoder-review projects Topcoder 0 $CHAIN_CODE_VERSION
instantiateChaincode topcoder-review projects Members 0 $CHAIN_CODE_VERSION
# instantiateChaincode topcoder-review projects Moderators 0 $CHAIN_CODE_VERSION


echo ""
echo "   _____ _    _  _____ _____ ______ ______ _____  ______ _____  "
echo "  / ____| |  | |/ ____/ ____|  ____|  ____|  __ \|  ____|  __ \ "
echo " | (___ | |  | | |   | |    | |__  | |__  | |  | | |__  | |  | |"
echo "  \___ \| |  | | |   | |    |  __| |  __| | |  | |  __| | |  | |"
echo "  ____) | |__| | |___| |____| |____| |____| |__| | |____| |__| |"
echo " |_____/ \____/ \_____\_____|______|______|_____/|______|_____/ "
echo "                                                                "
echo " Successfully install the topcoder-review network"
