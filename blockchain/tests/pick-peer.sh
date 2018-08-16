#!/bin/bash
#
# Copyright (c) 2018 TopCoder, Inc. All rights reserved.
#
# author: TCSDEVELOPER
# version: 1.0
#

#######################
# This is a helper script to set the peer selection global environment variables.
#######################

# set the peer's org and peer host
ORGANIZATION=Topcoder
ORGANIZATION_DOMAIN=topcoder.topcoder.com
PEER_HOST=peer1.topcoder.topcoder.com

# set the environments (You don't have to change this section)
CORE_PEER_LOCALMSPID=${ORGANIZATION}MSP
CORE_PEER_ADDRESS=${PEER_HOST}:7051
CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORGANIZATION_DOMAIN}/users/Admin@${ORGANIZATION_DOMAIN}/msp
CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORGANIZATION_DOMAIN}/peers/${PEER_HOST}/tls/ca.crt
CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORGANIZATION_DOMAIN}/peers/${PEER_HOST}/tls/server.key
CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORGANIZATION_DOMAIN}/peers/${PEER_HOST}/tls/server.crt

# call your command here
$@
