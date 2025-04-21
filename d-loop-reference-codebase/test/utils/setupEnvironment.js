const { ethers, upgrades } = require("hardhat");

/**
 * Setup testing environment with all required mock contracts and utilities
 * @returns {Promise<Object>} Object containing deployed contract instances and utilities
 */
async function setupEnvironment() {
  const [owner, admin, proposer, voter1, voter2, voter3, user] = await ethers.getSigners();

  // Deploy Mock Tokens
  const MockToken = await ethers.getContractFactory("MockToken");
  const dloopToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
  const mockToken1 = await MockToken.deploy("Mock Token 1", "MT1", 18);
  const mockToken2 = await MockToken.deploy("Mock Token 2", "MT2", 8);

  // Deploy Mock Oracle
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const primaryOracle = await MockOracle.deploy();
  const backupOracle = await MockOracle.deploy();

  // Mint some tokens for testing
  const mintAmount = ethers.parseEther("1000000"); // 1M tokens
  await dloopToken.mint(owner.address, mintAmount);
  await mockToken1.mint(owner.address, mintAmount);
  await mockToken2.mint(owner.address, ethers.parseUnits("1000000", 8));

  // Transfer tokens to test accounts
  const distributeAmount = ethers.parseEther("100000");
  for (const account of [admin, proposer, voter1, voter2, voter3]) {
    await dloopToken.transfer(account.address, distributeAmount);
  }

  // Set up price oracle data
  await primaryOracle.setPrice(mockToken1.address, ethers.parseUnits("100", 8)); // $100
  await primaryOracle.setPrice(mockToken2.address, ethers.parseUnits("10000", 8)); // $10,000
  await backupOracle.setPrice(mockToken1.address, ethers.parseUnits("101", 8)); // $101
  await backupOracle.setPrice(mockToken2.address, ethers.parseUnits("10100", 8)); // $10,100

  // Helper function to encode proposal parameters
  function encodeParameters(params) {
    // [action, tokenAddress, amount]
    // action: 0 = invest, 1 = divest
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8", "address", "uint256"],
      [params[0], params[1], params[2]]
    );
  }

  // Helper function to increase blockchain time
  async function timeTravel(seconds) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
  }

  return {
    accounts: {
      owner,
      admin,
      proposer,
      voter1,
      voter2,
      voter3,
      user
    },
    tokens: {
      dloopToken,
      mockToken1,
      mockToken2
    },
    oracles: {
      primaryOracle,
      backupOracle
    },
    utils: {
      encodeParameters,
      timeTravel,
      mintAmount,
      distributeAmount
    }
  };
}

module.exports = {
  setupEnvironment
};
