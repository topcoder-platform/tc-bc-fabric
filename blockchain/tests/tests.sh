#!/bin/bash

#
# Copyright (c) 2018 TopCoder, Inc. All rights reserved.
#
# author: TCSDEVELOPER
# version: 1.0
#

#######################
# This is a script to test the chaincode invoke/query, and IPFS.
#######################

# import utils
. scripts/utils.sh


echo "uploading file to IPFS..."
set -x
UPLOAD_RESULT=`curl -s "${IPFS_API_ENTRYPOINT}/add" -F file=@./tests/test_files/hello_world.txt`
set +x
echo $UPLOAD_RESULT
FILE_HASH=`echo $UPLOAD_RESULT | sed  -e 's/^.*Hash":"\([^"]*\).*$/\1/'`
echo "adding the file hash ${FILE_HASH} to Fabric"


echo "retrieving all the users..."
chaincodeQuery topcoder-review users '{"Args":["listUsers"]}' Topcoder 0

echo "retrieving all the projects..."
chaincodeQuery topcoder-client projects '{"Args":["listProjects"]}' Topcoder 0

echo "retrieving all the projects..."
chaincodeQuery topcoder-review projects '{"Args":["listProjects"]}' Topcoder 0

echo "retrieving all the projects..."
chaincodeQuery topcoder-review projects '{"Args":["Init"]}' Members 0

echo "retrieving all the projects..."
chaincodeQuery topcoder-review projects '{"Args":["listProjects"]}' Moderators 0