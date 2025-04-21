// Simple script to check if environment variables are loaded correctly
require('dotenv').config();

console.log('Checking environment variables:');
console.log('SEPOLIA_RPC_URL:', process.env.SEPOLIA_RPC_URL ? 'Set' : 'Not set');
console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? `Set (${process.env.PRIVATE_KEY.substring(0, 6)}...)` : 'Not set');
console.log('ETHERSCAN_API_KEY:', process.env.ETHERSCAN_API_KEY ? 'Set' : 'Not set');
console.log('DEPLOYER_ADDRESS:', process.env.DEPLOYER_ADDRESS ? process.env.DEPLOYER_ADDRESS : 'Not set');
