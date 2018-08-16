#!/bin/bash


COMPOSE_FILE=./fabric-ca/docker-compose.yaml
ORGS="Topcoder Clients Members Moderators"
CA_PROJECT_NAME="ca"

# Print the usage message
function printHelp() {
  echo "Usage: "
  echo "  fabric-ca.sh <mode> [-f <docker-compose-file>]"
  echo "    <mode> - one of 'up', 'down', 'restart', 'generate'"
  echo "      - 'up' - bring up the fabric ca with docker-compose up"
  echo "      - 'down' - clear the fabric ca with docker-compose down"
  echo "    -f <docker-compose-file> - specify which docker-compose file use (defaults to fabric-ca/docker-compose.yaml)"
  echo "  fabric-ca.sh -h (print this message)"
}


function startCA() {
   docker-compose -f $COMPOSE_FILE -p $CA_PROJECT_NAME up -d  2>&1
   if [ $? -ne 0 ]; then
     echo "ERROR !!!! Unable to start fabric ca"
     exit 1
   fi
}

function stopCA() {
    docker-compose -f $COMPOSE_FILE -p $CA_PROJECT_NAME down --volumes --remove-orphans
}


MODE=$1

while getopts "h?f:" opt; do
  case "$opt" in
  h | \?)
    printHelp
    exit 0
    ;;
  f)
    COMPOSE_FILE=$OPTARG
    ;;
  esac
done

#Create the network using docker compose
if [ "${MODE}" == "up" ]; then
  startCA
elif [ "${MODE}" == "down" ]; then ## Clear the network
  stopCA
else
  printHelp
  exit 1
fi
