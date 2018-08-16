#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

set -e

ORG=`echo $ORGANIZATION | tr '[:upper:]' '[:lower:]'`
SK_FULL_PATH=`ls /etc/hyperledger/fabric-ca-server-config/*_sk`
SK_FILE=`basename $SK_FULL_PATH`

topcoder_ROLES=manager
clients_ROLES=client
moderators_ROLES=copilot,reviewer
members_ROLES=member

export FABRIC_CA_SERVER_CSR_CN=rca-${ORG}
export FABRIC_CA_SERVER_CSR_HOSTS=rca-${ORG}
export FABRIC_CA_SERVER_CA_NAME=rca-${ORG}
export FABRIC_CA_SERVER_CA_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.${ORG}.topcoder.com-cert.pem
export FABRIC_CA_SERVER_CA_KEYFILE=/etc/hyperledger/fabric-ca-server-config/${SK_FILE}
export FABRIC_CA_SERVER_TLS_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.${ORG}.topcoder.com-cert.pem
export FABRIC_CA_SERVER_TLS_KEYFILE=/etc/hyperledger/fabric-ca-server-config/${SK_FILE}

# Initialize the root CA
fabric-ca-server init -b $BOOTSTRAP_USER_PASS

cp /etc/hyperledger/fabric-ca/config/fabric-ca-server-config.yaml /etc/hyperledger/fabric-ca/fabric-ca-server-config.yaml
ROLES=$(eval echo "\$${ORG}_ROLES")
sed -i "s/##USER_ROLE_PLACEHOLDER##/${ROLES}/g" /etc/hyperledger/fabric-ca/fabric-ca-server-config.yaml

# Start the root CA
fabric-ca-server start
