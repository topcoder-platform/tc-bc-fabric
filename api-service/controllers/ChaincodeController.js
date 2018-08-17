const service = require('../services/FabricService');
const userService = require('../services/UserService');

async function getTransaction(req, res) {
    console.log(req.createdBy);
    const client = await userService.validateUserAndEnroll(req.body.createdBy, ['manager', 'client']);
    res.json(await service.getTransactionByID(client, client.getChannel('topcoder-client'), req.body.trxnID));
}

module.exports = {
    getTransaction
};

