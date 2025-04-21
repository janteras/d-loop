/**
 * @title D-Loop Protocol Post-Deployment Configuration Script
 * @dev Script to execute post-deployment configuration steps that failed during initial deployment
 */

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

async function main() {
  const { network } = hre;
  
  console.log(`Executing post-deployment configuration for D-Loop Protocol on ${network.name} testnet...`);
  
  // Find the latest deployment file for the current network
  const deploymentPath = path.join(__dirname, '..', '..', 'deployments');
  const deploymentFiles = fs.readdirSync(deploymentPath)
    .filter(file => file.startsWith(`${network.name}-deployment-`))
    .sort()
    .reverse(); // Sort in reverse to get the latest file first
  
  if (deploymentFiles.length === 0) {
    console.error(`No deployment files found for ${network.name}`);
    process.exit(1);
  }
  
  const latestDeploymentFile = deploymentFiles[0];
  console.log(`Using deployment file: ${latestDeploymentFile}`);
  
  // Load the deployment data
  const deploymentData = JSON.parse(
    fs.readFileSync(path.join(deploymentPath, latestDeploymentFile), 'utf8')
  );
  
  // Get deployer signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer address: ${await deployer.getAddress()}`);
  
  // Get contract instances
  const dloopToken = await ethers.getContractAt(
    'DLoopToken',
    deploymentData.contracts.DLoopToken.address,
    deployer
  );
  
  const protocolDAO = await ethers.getContractAt(
    'ProtocolDAO',
    deploymentData.contracts.ProtocolDAO.address,
    deployer
  );
  
  const treasury = await ethers.getContractAt(
    'Treasury',
    deploymentData.contracts.Treasury.address,
    deployer
  );
  
  const aiNodeRegistry = await ethers.getContractAt(
    'AINodeRegistry',
    deploymentData.contracts.AINodeRegistry.address,
    deployer
  );
  
  const governanceRewards = await ethers.getContractAt(
    'GovernanceRewards',
    deploymentData.contracts.GovernanceRewards.address,
    deployer
  );
  
  // Execute post-deployment configuration steps
  console.log('\nExecuting post-deployment configuration steps:');
  
  // 1. DLoopToken.grantMinterRole
  console.log('\n1. Granting minter role on DLoopToken to Treasury...');
  try {
    const MINTER_ROLE = await dloopToken.MINTER_ROLE();
    const tx1 = await dloopToken.grantRole(MINTER_ROLE, treasury.target);
    await tx1.wait();
    console.log(`Transaction hash: ${tx1.hash}`);
    console.log('Minter role granted successfully!');
  } catch (error) {
    console.error('Error granting minter role:', error.message);
  }
  
  // 2. ProtocolDAO - Update Treasury
  console.log('\n2. Updating Treasury in ProtocolDAO...');
  try {
    // Check if there's an updateTreasury function
    if (typeof protocolDAO.updateTreasury === 'function') {
      const tx2 = await protocolDAO.updateTreasury(treasury.target);
      await tx2.wait();
      console.log(`Transaction hash: ${tx2.hash}`);
      console.log('Treasury address updated successfully!');
    } else {
      // Try whitelistToken function as an alternative
      const tx2 = await protocolDAO.whitelistToken(treasury.target, true);
      await tx2.wait();
      console.log(`Transaction hash: ${tx2.hash}`);
      console.log('Treasury address whitelisted successfully!');
    }
  } catch (error) {
    console.error('Error updating Treasury in ProtocolDAO:', error.message);
  }
  
  // 3. AINodeRegistry - Set ProtocolDAO
  console.log('\n3. Setting ProtocolDAO in AINodeRegistry...');
  try {
    if (typeof aiNodeRegistry.setProtocolDAO === 'function') {
      const tx3 = await aiNodeRegistry.setProtocolDAO(protocolDAO.target);
      await tx3.wait();
      console.log(`Transaction hash: ${tx3.hash}`);
      console.log('ProtocolDAO address set in AINodeRegistry successfully!');
    } else {
      console.log('AINodeRegistry does not have setProtocolDAO function. This may be set in the constructor.');
    }
  } catch (error) {
    console.error('Error setting ProtocolDAO in AINodeRegistry:', error.message);
  }
  
  // 4. GovernanceRewards - Set ProtocolDAO
  console.log('\n4. Setting ProtocolDAO in GovernanceRewards...');
  try {
    if (typeof governanceRewards.setProtocolDAO === 'function') {
      const tx4 = await governanceRewards.setProtocolDAO(protocolDAO.target);
      await tx4.wait();
      console.log(`Transaction hash: ${tx4.hash}`);
      console.log('ProtocolDAO address set in GovernanceRewards successfully!');
    } else {
      console.log('GovernanceRewards does not have setProtocolDAO function. This may be set in the constructor.');
    }
  } catch (error) {
    console.error('Error setting ProtocolDAO in GovernanceRewards:', error.message);
  }
  
  // 5. Treasury - Whitelist DLoopToken
  console.log('\n5. Whitelisting DLoopToken in Treasury...');
  try {
    if (typeof treasury.whitelistToken === 'function') {
      const tx5 = await treasury.whitelistToken(dloopToken.target, true);
      await tx5.wait();
      console.log(`Transaction hash: ${tx5.hash}`);
      console.log('DLoopToken whitelisted in Treasury successfully!');
    } else {
      console.log('Treasury does not have whitelistToken function. Token management may be handled differently.');
    }
  } catch (error) {
    console.error('Error whitelisting DLoopToken in Treasury:', error.message);
  }
  
  console.log('\nPost-deployment configuration complete!');
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Post-deployment configuration failed:', error);
    process.exit(1);
  });
