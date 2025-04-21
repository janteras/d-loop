const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  console.log("Analyzing contract storage layouts...");

  // Get the contract factories - these will need to be updated with actual contract names
  // For demonstration purposes, we're using placeholders
  const contractNames = [
    "AssetDAO", 
    "ProtocolDAO",
    "DAIToken",
    "DLOOPToken"
  ];
  
  const outputDir = path.join(__dirname, "../docs/storage-layouts");
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (const contractName of contractNames) {
    try {
      console.log(`\nAnalyzing storage layout for ${contractName}...`);
      // This will need actual contract deployment when available
      // For now, just get the contract factory
      let ContractFactory;
      try {
        ContractFactory = await hre.ethers.getContractFactory(contractName);
      } catch (error) {
        console.log(`Contract ${contractName} not found. Skipping.`);
        continue;
      }
      
      // When we have a deployed contract:
      // const contract = await ContractFactory.attach("CONTRACT_ADDRESS");
      
      // Get storage layout
      // Note: this will only work once we have actual contracts compiled
      // For now, this is placeholder code
      await hre.storageLayout.export();
      
      // Read the storage layout JSON
      const storageLayoutPath = path.join(
        hre.config.paths.artifacts,
        "storage-layouts",
        `${contractName}.json`
      );
      
      if (fs.existsSync(storageLayoutPath)) {
        const storageLayout = JSON.parse(
          fs.readFileSync(storageLayoutPath, "utf8")
        );
        
        // Output to a markdown file
        const outputPath = path.join(outputDir, `${contractName}.md`);
        
        let markdown = `# ${contractName} Storage Layout\n\n`;
        markdown += `## Storage Slots\n\n`;
        markdown += `| Name | Type | Slot | Offset | Bytes |\n`;
        markdown += `|------|------|------|--------|-------|\n`;
        
        for (const slot of storageLayout.storage || []) {
          markdown += `| ${slot.label} | ${slot.type} | ${slot.slot} | ${slot.offset} | ${slot.bytes} |\n`;
        }
        
        markdown += `\n## Storage Hash\n\n`;
        markdown += `\`${storageLayout.storageHash}\`\n`;
        
        fs.writeFileSync(outputPath, markdown);
        console.log(`Storage layout for ${contractName} written to ${outputPath}`);
      } else {
        console.log(`Storage layout not available for ${contractName}`);
      }
    } catch (error) {
      console.error(`Error analyzing ${contractName}:`, error);
    }
  }
  
  console.log("\nStorage analysis complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
