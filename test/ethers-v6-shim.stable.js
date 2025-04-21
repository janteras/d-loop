// Shim to bridge ethers v5 and v6 differences
const { ethers } = require('ethers');

module.exports = {
  ...ethers,
  ZeroAddress: ethers.constants.AddressZero,
  parseUnits: ethers.utils.parseUnits,
  parseEther: ethers.utils.parseEther,
  formatEther: ethers.utils.formatEther
};
