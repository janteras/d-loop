/**
 * @title D-Loop Protocol Contract Verification Script
 * @dev Script to verify all deployed contracts on Etherscan using the deployment file
 */

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const { network } = hre;
  
  console.log(`Verifying D-Loop Protocol contracts on ${network.name} testnet...`);
  
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
  
  // Verify each contract
  for (const [name, contractInfo] of Object.entries(deploymentData.contracts)) {
    console.log(`Verifying ${name} at ${contractInfo.address}...`);
    
    try {
      await hre.run('verify:verify', {
        address: contractInfo.address,
        constructorArguments: contractInfo.args
      });
      console.log(`${name} verified successfully!`);
    } catch (error) {
      if (error.message.includes('Already Verified')) {
        console.log(`${name} is already verified.`);
      } else {
        console.error(`Error verifying ${name}:`, error.message);
      }
    }
    
    // Add a small delay between verifications to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('Contract verification complete!');
}

// Execute the verification
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
