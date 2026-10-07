const MyContract = artifacts.require("./MyContract.sol");
const MoneyManagement = artifacts.require("./MoneyManagement.sol");

module.exports = function(deployer) {
  deployer.deploy(MyContract);
  deployer.deploy(MoneyManagement);
};