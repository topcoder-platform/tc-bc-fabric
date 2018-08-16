#!/bin/sh

SOURCE_CONFIG_DIR=../blockchain/crypto-config

if [ "$1" != "" ]; then
    SOURCE_CONFIG_DIR=$1
fi

rm -rf ./config/fabric/crypto-config
cp -r ${SOURCE_CONFIG_DIR} ./config/fabric
if [ $? != 0 ]; then
    echo "Failed to copy certs config from ${SOURCE_CONFIG_DIR} !!!!"
    exit -1
fi

for i in ./config/fabric/crypto-config/peerOrganizations/topcoder.topcoder.com/users/Admin@topcoder.topcoder.com/msp/keystore/*_sk
do
    cp $i ./config/fabric/crypto-config/peerOrganizations/topcoder.topcoder.com/users/Admin@topcoder.topcoder.com/msp/keystore/admin_sk
done

echo "Successfully copy certs from ${SOURCE_CONFIG_DIR}"
