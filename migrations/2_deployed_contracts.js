const RentalAgreement = artifacts.require("./RentalAgreement.sol");

module.exports = function(deployer) {
  // Deploy RentalAgreement with sample initial values:
  // Property: "123 Main Street, Apt 4B"
  // Monthly Rent: 0.01 ETH (in wei)
  // Deposit: 0.02 ETH (in wei)
  // Lease Duration: 12 months
  deployer.deploy(
    RentalAgreement,
    "123 Main Street, Apt 4B",
    web3.utils.toWei("0.01", "ether"),
    web3.utils.toWei("0.02", "ether"),
    12
  );
};