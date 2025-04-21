/**
 * @title D-Loop Protocol Deployment Key Management
 * @dev Script to securely manage deployment keys for testnet deployments
 * @notice This script helps generate and validate deployment keys
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to generate a new wallet
async function generateWallet() {
  console.log('\nGenerating new deployment wallet...');
  
  // Generate a random wallet
  const wallet = ethers.Wallet.createRandom();
  
  console.log(`\n===== WALLET DETAILS =====`);
  console.log(`Address: ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log(`Mnemonic: ${wallet.mnemonic.phrase}`);
  console.log(`===========================\n`);
  
  console.log('⚠️  IMPORTANT: Store this information securely!');
  console.log('Never share your private key or mnemonic with anyone.');
  
  // Ask if user wants to save to .env file
  rl.question('\nDo you want to save the private key to .env file? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      saveToEnvFile(wallet);
    } else {
      console.log('Private key not saved to .env file.');
      rl.close();
    }
  });
}

// Function to save wallet info to .env file
function saveToEnvFile(wallet) {
  const envPath = path.join(__dirname, '../../.env');
  
  // Check if .env file exists
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace existing private key if present
    if (envContent.includes('PRIVATE_KEY=')) {
      envContent = envContent.replace(/PRIVATE_KEY=.*$/m, `PRIVATE_KEY=${wallet.privateKey}`);
    } else {
      envContent += `\nPRIVATE_KEY=${wallet.privateKey}`;
    }
    
    // Replace existing deployer address if present
    if (envContent.includes('DEPLOYER_ADDRESS=')) {
      envContent = envContent.replace(/DEPLOYER_ADDRESS=.*$/m, `DEPLOYER_ADDRESS=${wallet.address}`);
    } else {
      envContent += `\nDEPLOYER_ADDRESS=${wallet.address}`;
    }
  } else {
    // Create new .env file
    envContent = `# D-Loop Protocol Environment Configuration\n\n`;
    envContent += `# Network RPC URLs\n`;
    envContent += `SEPOLINA_RPC_URL=https://rpc.sepolina.dev\n\n`;
    envContent += `# Deployment keys\n`;
    envContent += `PRIVATE_KEY=${wallet.privateKey}\n`;
    envContent += `DEPLOYER_ADDRESS=${wallet.address}\n`;
  }
  
  // Write to .env file
  fs.writeFileSync(envPath, envContent);
  console.log(`Private key and address saved to .env file.`);
  
  // Remind user about security
  console.log('\n⚠️  IMPORTANT: The .env file contains sensitive information.');
  console.log('Make sure it is added to .gitignore and never committed to your repository.');
  
  rl.close();
}

// Function to check wallet balance
async function checkWalletBalance() {
  // Load private key from .env file
  const envPath = path.join(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) {
    console.log('Error: .env file not found. Please run the generate command first.');
    rl.close();
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const privateKeyMatch = envContent.match(/PRIVATE_KEY=(.*)$/m);
  
  if (!privateKeyMatch || !privateKeyMatch[1]) {
    console.log('Error: Private key not found in .env file.');
    rl.close();
    return;
  }
  
  const privateKey = privateKeyMatch[1].trim();
  const wallet = new ethers.Wallet(privateKey);
  
  console.log(`\nChecking balance for address: ${wallet.address}`);
  console.log(`\nIMPORTANT: To fund this wallet for Sepolina Testnet deployment, send ETH to:`);
  console.log(`\n${wallet.address}\n`);
  
  // Check balance on different networks
  try {
    // Hardhat local network
    try {
      const hardhatProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      const hardhatBalance = await hardhatProvider.getBalance(wallet.address);
      console.log(`Hardhat Local: ${ethers.formatEther(hardhatBalance)} ETH`);
    } catch (error) {
      console.log(`Hardhat Local: Error connecting to network`);
    }
    
    // Sepolina testnet
    try {
      const sepolinaRpcUrl = process.env.SEPOLINA_RPC_URL || 'https://rpc.sepolina.dev';
      const sepolinaProvider = new ethers.JsonRpcProvider(sepolinaRpcUrl);
      const sepolinaBalance = await sepolinaProvider.getBalance(wallet.address);
      console.log(`Sepolina Testnet: ${ethers.formatEther(sepolinaBalance)} ETH`);
      
      // Check if balance is sufficient for deployment
      if (sepolinaBalance < ethers.parseEther('0.1')) {
        console.log(`⚠️  Warning: Balance on Sepolina is low. Consider funding the wallet before deployment.`);
      }
    } catch (error) {
      console.log(`Sepolina Testnet: Error connecting to network`);
    }
    
    // Sepolia testnet
    const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
    if (sepoliaRpcUrl) {
      try {
        const sepoliaProvider = new ethers.JsonRpcProvider(sepoliaRpcUrl);
        const sepoliaBalance = await sepoliaProvider.getBalance(wallet.address);
        console.log(`Sepolia Testnet: ${ethers.formatEther(sepoliaBalance)} ETH`);
      } catch (error) {
        console.log(`Sepolia Testnet: Error connecting to network`);
      }
    } else {
      console.log(`Sepolia Testnet: RPC URL not configured`);
    }
  } catch (error) {
    console.log(`Error checking balances: ${error.message}`);
  }
  
  console.log(`\nTo fund this wallet for deployment, send ETH to the address above.`);
  console.log(`You'll need approximately 0.2 ETH for a full protocol deployment.`);
  
  rl.close();
}

// Function to validate environment setup
async function validateEnvironment() {
  console.log('\nValidating deployment environment...');
  
  const envPath = path.join(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found. Please create one based on .env.example.');
    rl.close();
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check required variables
  const requiredVars = [
    { name: 'PRIVATE_KEY', message: 'Deployment private key' },
    { name: 'SEPOLINA_RPC_URL', message: 'Sepolina RPC URL' }
  ];
  
  let allValid = true;
  
  for (const variable of requiredVars) {
    const match = envContent.match(new RegExp(`${variable.name}=(.*)$`, 'm'));
    if (!match || !match[1].trim()) {
      console.log(`❌ ${variable.message} not configured in .env file.`);
      allValid = false;
    } else {
      console.log(`✅ ${variable.message} configured.`);
    }
  }
  
  // Validate private key format if present
  const privateKeyMatch = envContent.match(/PRIVATE_KEY=(.*)$/m);
  if (privateKeyMatch && privateKeyMatch[1].trim()) {
    const privateKey = privateKeyMatch[1].trim();
    try {
      new ethers.Wallet(privateKey);
      console.log(`✅ Private key format is valid.`);
      
      // Display the wallet address for reference
      const wallet = new ethers.Wallet(privateKey);
      console.log(`✅ Deployment wallet address: ${wallet.address}`);
      
      // Check if DEPLOYER_ADDRESS is set correctly
      const deployerMatch = envContent.match(/DEPLOYER_ADDRESS=(.*)$/m);
      if (deployerMatch && deployerMatch[1].trim()) {
        const deployerAddress = deployerMatch[1].trim();
        if (deployerAddress.toLowerCase() === wallet.address.toLowerCase()) {
          console.log(`✅ DEPLOYER_ADDRESS matches the private key.`);
        } else {
          console.log(`❌ DEPLOYER_ADDRESS does not match the private key.`);
          console.log(`   Expected: ${wallet.address}`);
          console.log(`   Found: ${deployerAddress}`);
          allValid = false;
        }
      } else {
        console.log(`❌ DEPLOYER_ADDRESS not configured in .env file.`);
        allValid = false;
      }
      
      // Try to connect to Sepolina RPC
      try {
        const sepolinaRpcUrl = envContent.match(/SEPOLINA_RPC_URL=(.*)$/m)[1].trim();
        console.log(`✅ Attempting to connect to Sepolina RPC: ${sepolinaRpcUrl}`);
        const provider = new ethers.JsonRpcProvider(sepolinaRpcUrl);
        const network = await provider.getNetwork();
        console.log(`✅ Successfully connected to network: ${network.name} (Chain ID: ${network.chainId})`);
      } catch (error) {
        console.log(`❌ Failed to connect to Sepolina RPC: ${error.message}`);
        allValid = false;
      }
    } catch (error) {
      console.log(`❌ Private key format is invalid.`);
      allValid = false;
    }
  }
  
  if (allValid) {
    console.log('\n✅ Environment validation passed. Ready for deployment!');
  } else {
    console.log('\n❌ Environment validation failed. Please fix the issues before deploying.');
  }
  
  rl.close();
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Please specify a command: generate, balance, or validate');
    rl.close();
    return;
  }
  
  switch (command) {
    case 'generate':
      await generateWallet();
      break;
    case 'balance':
      await checkWalletBalance();
      break;
    case 'validate':
      await validateEnvironment();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log('Available commands: generate, balance, validate');
      rl.close();
  }
}

// Run the script
main().catch((error) => {
  console.error(error);
  rl.close();
  process.exit(1);
});
