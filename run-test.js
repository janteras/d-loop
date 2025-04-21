// Minimal Hardhat test runner
const { execSync } = require('child_process');

async function main() {
  console.log("Starting Hardhat minimal test...");
  
  try {
    // Check Hardhat version to ensure it's working
    console.log("Checking Hardhat version:");
    const hardhatVersion = execSync('npx hardhat --version').toString().trim();
    console.log("Hardhat version:", hardhatVersion);
    
    // Run our simple test that doesn't require compilation
    console.log("\nRunning simple test:");
    const result = execSync('npx hardhat test test/SimpleTest.js --no-compile').toString();
    console.log(result);
    
    console.log("Hardhat minimal test completed successfully!");
  } catch (error) {
    console.error("Error running Hardhat tests:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });