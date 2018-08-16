#
# Copyright (c) 2018 TopCoder, Inc. All rights reserved.
#
# author: TCSDEVELOPER
# version: 1.0
#

#######################
# This is a collection of bash functions used by different scripts
#######################

# import the configurations
. ./scripts/config.sh

# the oderer certificate
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/${ORDERER_DOMAIN}/orderers/${ORDERER_HOST}/msp/tlscacerts/tlsca.${ORDERER_DOMAIN}-cert.pem

# the counter
COUNTER=1

# verify the result of the end-to-end
# USAGE: verifyResult $RES
verifyResult() {
  if [ $1 -ne 0 ]; then
    echo "!!!!!!!!!!!!!!! "$2" !!!!!!!!!!!!!!!!"
    echo "========= ERROR !!! FAILED to execute End-2-End Scenario ==========="
    echo
    exit 1
  fi
}

# sets the global variables for the picked peer
# USAGE: setGlobals $ORG $PEER
setGlobals() {
  ORG=$1
  PEER=$2

  LOWER_CASE_ORG=`echo "$ORG" | tr '[:upper:]' '[:lower:]'`
  ORG_DOMAIN=${LOWER_CASE_ORG}.${MAIN_DOMAIN}
  PEER_HOST=peer${PEER}.${ORG_DOMAIN}

  CORE_PEER_LOCALMSPID=$ORG"MSP"
  CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/peers/${PEER_HOST}/tls/ca.crt
  CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp
  CORE_PEER_ADDRESS=${PEER_HOST}:7051
  CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/peers/${PEER_HOST}/tls/server.key
  CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/peers/${PEER_HOST}/tls/server.crt
  if [ "$VERBOSE" == "true" ]; then
    env | grep CORE
  fi
}

# updates an anchor peer
# USAGE: updateAnchorPeers $CHANNEL_NAME $ORG $PEER
updateAnchorPeers() {
  CHANNEL_NAME=$1
  ORG=$2
  PEER=$3
  setGlobals $ORG $PEER
  if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
    set -x
    peer channel update -o ${ORDERER_ADDRESS} -c $CHANNEL_NAME -f ./channel-artifacts/${CORE_PEER_LOCALMSPID}-${CHANNEL_NAME}-anchors.tx >&log.txt
    res=$?
    set +x
  else
    set -x
    peer channel update -o ${ORDERER_ADDRESS} -c $CHANNEL_NAME -f ./channel-artifacts/${CORE_PEER_LOCALMSPID}-${CHANNEL_NAME}-anchors.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&log.txt
    res=$?
    set +x
  fi
  cat log.txt
  verifyResult $res "Anchor peer update failed"
  echo "===================== Anchor peers updated for org '$CORE_PEER_LOCALMSPID' on channel '$CHANNEL_NAME' ===================== "
  sleep $DELAY
  echo
}

# Sometimes Join takes time hence RETRY at least 5 times
# USAGE: joinChannelWithRetry $CHANNEL_NAME $ORG $PEER
joinChannelWithRetry() {
  CHANNEL_NAME=$1
  ORG=$2
  PEER=$3

  setGlobals $ORG $PEER

  set -x
  peer channel join -b $CHANNEL_NAME.block >&log.txt
  res=$?
  set +x
  cat log.txt
  if [ $res -ne 0 -a $COUNTER -lt $MAX_RETRY ]; then
    COUNTER=$(expr $COUNTER + 1)
    echo "peer${PEER}.${ORG} failed to join the channel ${CHANNEL_NAME}, Retry after $DELAY seconds"
    sleep $DELAY
    joinChannelWithRetry $CHANNEL_NAME $ORG $PEER
  else
    COUNTER=1
  fi
  verifyResult $res "After $MAX_RETRY attempts, peer${PEER}.${ORG} has failed to join channel '$CHANNEL_NAME' "
}

# installs a chaincode
# USAGE: installChaincode $CHAIN_CODE $ORG $PEER $CHAIN_CODE_VERSION
installChaincode() {
  CHAIN_CODE=$1
  ORG=$2
  PEER=$3
  VERSION=$4

  setGlobals $ORG $PEER
  CHAIN_CODE_PATH=/opt/gopath/src/github.com/chaincode/${CHAIN_CODE}
  set -x
  peer chaincode install -n ${CHAIN_CODE} -v ${VERSION} -l node -p ${CHAIN_CODE_PATH} >&log.txt
  res=$?
  set +x
  cat log.txt
  verifyResult $res "Chaincode: ${CHAIN_CODE} installation on peer${PEER}.${ORG} has failed"
  echo "===================== Chaincode: ${CHAIN_CODE} is installed on peer${PEER}.${ORG} ===================== "
  echo
}

# instantiates a chaincode
# USAGE: instantiateChaincode $CHANNEL_NAME $CHAIN_CODE $ORG $PEER $CHAIN_CODE_VERSION
instantiateChaincode() {
  CHANNEL_NAME=$1
  CHAIN_CODE=$2
  ORG=$3
  PEER=$4
  VERSION=$5
  setGlobals $ORG $PEER

  # while 'peer chaincode' command can get the orderer endpoint from the peer
  # (if join was successful), let's supply it directly as we know it using
  # the "-o" option
  if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
    set -x
    peer chaincode instantiate -o ${ORDERER_ADDRESS} -C $CHANNEL_NAME -n ${CHAIN_CODE} -l node -v ${VERSION} -c '{"Args":[]}' >&log.txt
    res=$?
    set +x
  else
    set -x
    peer chaincode instantiate -o ${ORDERER_ADDRESS} --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n ${CHAIN_CODE} -l node -v ${VERSION} -c '{"Args":[]}' >&log.txt
    res=$?
    set +x
  fi
  cat log.txt
  verifyResult $res "Chaincode: ${CHAIN_CODE} installation on peer${PEER}.${ORG} on channel: ${CHANNEL_NAME} has failed"
  echo "===================== Chaincode: ${CHAIN_CODE} is instantiate on peer${PEER}.${ORG} on channel: ${CHANNEL_NAME} ===================== "
  echo
}

# updates a chaincode
# USAGE: upgradeChaincode $CHANNEL_NAME $CHAIN_CODE $CHAIN_CODE_VERSION $ORG $PEER
upgradeChaincode() {
  CHANNEL_NAME=$1
  CHAIN_CODE=$2
  CHAIN_CODE_VERSION=$3
  ORG=$4
  PEER=$5
  setGlobals $ORG $PEER
  set -x
  peer chaincode upgrade -o ${ORDERER_ADDRESS} --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n $CHAIN_CODE -v $CHAIN_CODE_VERSION -l node -c '{"Args":[]}' >&log.txt
  res=$?
  set +x
  cat log.txt
  verifyResult $res "Chaincode upgrade on peer${PEER}.${ORG} has failed"
  echo "===================== Chaincode is upgraded on peer${PEER}.org${ORG} on channel '$CHANNEL_NAME' ===================== "
  echo
}

# query the chaincode
# USAGE: chaincodeQuery $CHANNEL_NAME $CHAIN_CODE $CHAIN_CODE_ARGS $ORG $PEER
chaincodeQuery() {
  CHANNEL_NAME=$1
  CHAIN_CODE=$2
  CHAIN_CODE_ARGS=$3
  ORG=$4
  PEER=$5
  setGlobals $ORG $PEER
  echo "===================== Querying on peer${PEER}.${ORG} on channel '$CHANNEL_NAME'... ===================== "

  local rc=1
  local starttime=$(date +%s)

  # continue to poll
  # we either get a successful response, or reach TIMEOUT
  while
    test "$(($(date +%s) - starttime))" -lt "$TIMEOUT" -a $rc -ne 0
  do
    sleep $DELAY
    echo "Attempting to Query peer${PEER}.${ORG} ...$(($(date +%s) - starttime)) secs"
    set -x
    peer chaincode query -C $CHANNEL_NAME -n ${CHAIN_CODE} -c ${CHAIN_CODE_ARGS} >&log.txt
    res=$?
    set +x
    let rc=0
  done
  echo
  cat log.txt
  echo "===================== Query successful on peer${PEER}.${ORG} on channel '$CHANNEL_NAME' of chaincode '$CHAIN_CODE'===================== "
}


# parsePeerConnectionParameters $@
# Helper function that takes the parameters from a chaincode operation
# (e.g. invoke, query, instantiate) and checks for an even number of
# peers and associated org, then sets $PEER_CONN_PARMS and $PEERS
parsePeerConnectionParameters() {
  # check for uneven number of peer and org parameters
  if [ $(($# % 2)) -ne 0 ]; then
    exit 1
  fi

  PEER_CONN_PARMS=""
  PEERS=""
  while [ "$#" -gt 0 ]; do
    ORG=`echo "$1" | tr '[:upper:]' '[:lower:]'`
    PEER=$2
    PEER_STR="peer$PEER.$ORG"
    PEERS="$PEERS $PEER_STR"
    PEER_CONN_PARMS="$PEER_CONN_PARMS --peerAddresses $PEER_STR.$MAIN_DOMAIN:7051"
    if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "true" ]; then
      CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.${MAIN_DOMAIN}/peers/peer${PEER}.${ORG}.${MAIN_DOMAIN}/tls/ca.crt
      TLSINFO=$(eval echo "--tlsRootCertFiles \$CERT_FILE")
      PEER_CONN_PARMS="$PEER_CONN_PARMS $TLSINFO"
    fi
    # shift by two to get the next pair of peer/org parameters
    shift
    shift
  done
  # remove leading space for output
  PEERS="$(echo -e "$PEERS" | sed -e 's/^[[:space:]]*//')"
}

# chaincodeInvoke $CHANEL_NAME $CHAIN_CODE $CHAIN_CODE_ARGS <peer> <org> ...
# Accepts as many peer/org pairs as desired and requests endorsement from each
chaincodeInvoke() {
  CHANNEL_NAME=$1
  CHAIN_CODE=$2
  CHAIN_CODE_ARGS=$3
  shift
  shift
  shift
  parsePeerConnectionParameters $@
  res=$?
  verifyResult $res "Invoke transaction failed on channel '$CHANNEL_NAME' due to uneven number of peer and org parameters "

  # while 'peer chaincode' command can get the orderer endpoint from the
  # peer (if join was successful), let's supply it directly as we know
  # it using the "-o" option
  if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
    set -x
    peer chaincode invoke -o ${ORDERER_ADDRESS} -C $CHANNEL_NAME -n ${CHAIN_CODE} $PEER_CONN_PARMS -c ${CHAIN_CODE_ARGS} >&log.txt
    res=$?
    set +x
  else
    set -x
    peer chaincode invoke -o ${ORDERER_ADDRESS} --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n ${CHAIN_CODE} $PEER_CONN_PARMS -c ${CHAIN_CODE_ARGS} >&log.txt
    res=$?
    set +x
  fi
  cat log.txt
  verifyResult $res "Invoke execution on $PEERS failed "
  echo "===================== Invoke transaction successful on $PEERS on channel '$CHANNEL_NAME' and chaincode===================== "
  echo
}

# CREATES a channel
# USAGES: createChannel $CHANNEL_NAME
createChannel() {
    CHANNEL_NAME=$1
	setGlobals Topcoder 0
	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
                set -x
		peer channel create -o ${ORDERER_ADDRESS} -c $CHANNEL_NAME -f "./channel-artifacts/"$CHANNEL_NAME"Channel.tx" >&log.txt
		res=$?
                set +x
	else
				set -x
		peer channel create -o ${ORDERER_ADDRESS} -c $CHANNEL_NAME -f "./channel-artifacts/"$CHANNEL_NAME"Channel.tx"  --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&log.txt
		res=$?
				set +x
	fi
	cat log.txt
	verifyResult $res "Channel creation failed"
	echo "===================== Channel '$CHANNEL_NAME' created ===================== "
	echo
}

# Joins a channel
# USAGE: joinChannel $CHANNEL_NAME $ORG $PEER
joinChannel () {
    CHANNEL_NAME=$1
    ORG=$2
    PEER=$3
    joinChannelWithRetry $CHANNEL_NAME $ORG $PEER
	echo "===================== peer${PEER}.${ORG} joined channel '$CHANNEL_NAME' ===================== "
	sleep $DELAY
	echo
}

