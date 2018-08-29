# Topcoder - PoC Challenge Review Process with Blockchain - API Setup

This is the validation document for PoC Challenge Review Process with Blockchain - API - Setup


## Postman Verification

Import Postman collection `docs/postman.json` with environment variables `docs/postman-env.json`.

**NOTE**: Because a project is copied to 'topcoder-review' channel only after its status is 'active'.
So after you created a project, please update its status to 'active' before testing the create challenge/register apis.


####Steps to verify upload/download submissions

1. Create a manager user
   Use the api in postman: `Users/POST Create User` to create a manager user.
2. Create a project
   User the api: `Projects/POST Create Project` to create a project.
3. Update the project to active
   User the api: `Projects/PUT Update Project (update to active)` to mark the project active.
4. Create a challenge of the project
   Use the api: `Challenges/POST Create Challenge` to create a challenge
5. Create a member to register that challenge
   Use the api: `Users/Post Create User (member)` to create a user of member role.
   Then, use the api: `Challenges/POST Register Challenge` to let the member user register in that challenge.
6. Upload a submission
   Use the api: `Challenges/POST Upload Submission` to upload submission for that member.
7. Download submission file
   Use the api: `Challenges/GET Download Submission` to download the submission file. In postman, click the button `Send and Download`, you can download the file to local file system and verify.
   Note, in this api, the memberId is set in the cookie, if you want to change the memberId, modify in `Headers` tab and the `Cookie` header.

8. To test download file with copilot role, you can:
   Use the api: `Challenges/POST Create User (copilot)` to create the copilot user.
   Use the api: `Projects/ PUT Update Project (set copilot)` to set the copilot to the project.
   Use the api: `Challenges/GET Download Submission (copilot)` to download with submission.
9. Failure tests are added in Challenges/Failures
10. If you want to view the whole ledger data, Use the test api: `/Projects GET List Projects - topcoder-review channel (TEST ONLY)`
