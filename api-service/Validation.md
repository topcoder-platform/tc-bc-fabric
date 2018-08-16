# Topcoder - PoC Challenge Review Process with Blockchain - API Setup

This is the validation document for PoC Challenge Review Process with Blockchain - API - Setup


## Postman Verification

Import Postman collection `docs/postman.json` with environment variables `docs/postman-env.json`.

**NOTE**: Because a project is copied to 'topcoder-review' channel only after its status is 'active'.
So after you created a project, please update its status to 'active' before testing the create challenge/register apis.


## KNOWN ISSUES

Because installing/instantiate a chaincode on a peer is very very slow, so I just install the chaincode on Topcoder/Client/Members organizations.
So, you can tests the roles with: 'manager', 'member', 'client'.
And only installed in one peer to one organizaion.
If you want to test other roles ('copilot', 'reviewer'), add the instantiate commands on the 'Moderators" organization in `blockchain/scripts/install.sh.`