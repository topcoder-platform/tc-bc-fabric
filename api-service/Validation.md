# Topcoder - PoC Challenge Review Process with Blockchain - API Setup

This is the validation document for PoC Challenge Review Process with Blockchain - API - Setup


## Postman Verification

Import Postman collection `docs/postman.json` with environment variables `docs/postman-env.json`.

**NOTE**: Because a project is copied to 'topcoder-review' channel only after its status is 'active'.
So after you created a project, please update its status to 'active' before testing the create challenge/register apis.


####Steps to verify upload/download submissions

1. Create the users for different roles
   Use the api in postman: `Users/POST Create User (manager)` to create a manager user.
   Use the api in postman: `Users/POST Create User (copilot)` to create a copilot user.
   Use the api in postman: `Users/POST Create User (reviewer)` to create a reviewer user.
   Use the api in postman: `Users/POST Create User (member)` to create a member user.
   Use the api in postman: `Users/POST Create User (client)` to create a client user.

2. Create the access tokens for different users
   User the api in postman: `Auth (TEST ONLY)/POST /login (manager)` to get the manager's access token
   User the api in postman: `Auth (TEST ONLY)/POST /login (client)` to get the client's access token
   User the api in postman: `Auth (TEST ONLY)/POST /login (reviewer)` to get the reviewer's access token
   User the api in postman: `Auth (TEST ONLY)/POST /login (member)` to get the member's access token
   User the api in postman: `Auth (TEST ONLY)/POST /login (copilot)` to get the copilot's access token

3. Create a project
   User the api: `Projects/POST Create Project` to create a project.
4. Update the project to active
   User the api: `Projects/PUT Update Project (update to active)` to mark the project active.
5. Create a challenge of the project
   Use the api: `Challenges/POST Create Challenge` to create a challenge
6. Create a scorecard for the challenge
   User the api: `Challenge Review/POST Create a challenge scorecard` to create a scorecard for the challenge.
7. Use a member to register that challenge
   use the api: `Challenges/POST Register Challenge` to let the member user register in that challenge.
8. Use a reviewer to register that challenge
   use the api: `Challenges/POST Register a reviewer to challenge` to register a reviewer.
9. Upload a submission
   Use the api: `Challenge Submission/POST Upload Submission` to upload submission for that member.
10. Download submission file
   Use the api: `Challenge Submission/GET Download Submission` to download the submission file. In postman, click the button `Send and Download`, you can download the file to local file system and verify.
11. Create a review
   Use the api: `Challenge Review/POST Create a challenge review` to create a challenge review.
12. Create an appeal
   Use the api: `Challenge Review/POST Create a challenge appeal` to create a challenge appeal.
13. Create an appeal response
   Use the api: `Challenge Review/POST Create a challenge appeal response` to create a challenge appeal response.
14. Failure tests are added in folder `*/Failures`
15. If you want to view the whole ledger data, Use the test api: `/Projects GET List Projects - topcoder-review channel`
16. _*IMPORTANT HINT*_: If you want to change the current phase of a challenge, you can use:
    `Challenges/POST Update Challenge (update phase)` api. In postman, you can open the `Pre-request Script` tab, and change the variable name: `preferCurrentPhase`

## Issues Verification
Please open the `./docs/POC_1_Issues_Features_List.xlsx` file, I added a `Validation` column which shows more details.