// Contract consolidation script
const fs = require('fs');
const path = require('path');

// Configuration
const CONTRACTS_DIR = 'contracts';
const CONSOLIDATED_DIR = 'consolidated-contracts';
const LOG_FILE = 'consolidation-report.log';

// Initialize log file
fs.writeFileSync(LOG_FILE, `DLOOP Contract Consolidation: ${new Date().toISOString()}\n\n`);

function log(message) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + '\n');
}

// Ensure consolidated directory exists
if (!fs.existsSync(CONSOLIDATED_DIR)) {
  fs.mkdirSync(CONSOLIDATED_DIR);
  log(`Created directory: ${CONSOLIDATED_DIR}`);
}

// Map to track duplicates and their content hashes
const fileMap = new Map();
const fileHashes = new Map();

// Find all Solidity files and organize by filename
function scanContracts(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      scanContracts(fullPath);
    } else if (entry.name.endsWith('.sol')) {
      // Add to file map
      if (!fileMap.has(entry.name)) {
        fileMap.set(entry.name, []);
      }
      fileMap.get(entry.name).push(fullPath);
      
      // Calculate content hash (simple content length for demo purposes)
      const content = fs.readFileSync(fullPath, 'utf8');
      fileHashes.set(fullPath, content.length);
    }
  }
}

// Create category directories in consolidated output
function createCategoryDirs() {
  const categories = [
    'tokens',      // Token-related contracts
    'governance',  // Governance mechanisms
    'fees',        // Fee calculation and distribution
    'identity',    // AI node identity and verification
    'oracles',     // Oracle price feeds
    'protocol',    // Core protocol components
    'interfaces',  // Interface definitions
    'utils',       // Utility contracts
    'mocks',       // Mock contracts for testing
    'bridges',     // Bridge implementations
  ];
  
  for (const category of categories) {
    const dir = path.join(CONSOLIDATED_DIR, category);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created category directory: ${dir}`);
    }
  }
}

// Determine the best version of each duplicate file
function findCanonicalVersions() {
  const canonicalFiles = new Map();
  
  for (const [filename, paths] of fileMap.entries()) {
    if (paths.length === 1) {
      // Only one version exists
      canonicalFiles.set(filename, paths[0]);
      continue;
    }
    
    log(`\nAnalyzing ${paths.length} versions of ${filename}:`);
    
    // Prioritize files in canonical directory if they exist
    const canonicalVersion = paths.find(p => p.includes('/canonical/'));
    if (canonicalVersion) {
      canonicalFiles.set(filename, canonicalVersion);
      log(`  Selected canonical version: ${canonicalVersion}`);
      continue;
    }
    
    // Otherwise, use the most specific path as a heuristic
    // For example, prefer contracts/tokens/DLoopToken.sol over contracts/DLoopToken.sol
    let bestPath = paths[0];
    let bestDepth = bestPath.split('/').length;
    
    for (const p of paths) {
      const depth = p.split('/').length;
      // Consider deeper paths to be more specific
      if (depth > bestDepth) {
        bestPath = p;
        bestDepth = depth;
      }
      
      log(`  ${p} (${fileHashes.get(p)} bytes)`);
    }
    
    canonicalFiles.set(filename, bestPath);
    log(`  Selected best version: ${bestPath}`);
  }
  
  return canonicalFiles;
}

// Copy canonical files to their appropriate category in consolidated directory
function copyToConsolidated(canonicalFiles) {
  for (const [filename, sourcePath] of canonicalFiles.entries()) {
    // Determine appropriate category based on path and filename
    let category = 'utils';  // Default
    
    if (filename.includes('Token') || sourcePath.includes('/token')) {
      category = 'tokens';
    } else if (filename.includes('DAO') || filename.includes('Governance') || sourcePath.includes('/governance')) {
      category = 'governance';
    } else if (filename.includes('Fee') || filename.includes('Treasury') || sourcePath.includes('/fees')) {
      category = 'fees';
    } else if (filename.includes('Oracle') || sourcePath.includes('/oracle')) {
      category = 'oracles';
    } else if (filename.includes('AI') || filename.includes('Soulbound') || filename.includes('Identity')) {
      category = 'identity';
    } else if (filename.includes('Protocol') || filename.includes('Asset')) {
      category = 'protocol';
    } else if (filename.includes('I') && filename.length > 2 && filename[0] === 'I' && filename[1].toUpperCase() === filename[1]) {
      category = 'interfaces';
    } else if (filename.includes('Mock')) {
      category = 'mocks';
    } else if (filename.includes('Bridge')) {
      category = 'bridges';
    }
    
    // Copy file to consolidated directory
    const destPath = path.join(CONSOLIDATED_DIR, category, filename);
    fs.copyFileSync(sourcePath, destPath);
    log(`Copied ${sourcePath} to ${destPath}`);
  }
}

// Create an index file summarizing the consolidated contracts
function createIndexFile() {
  let indexContent = `# DLOOP Consolidated Contract Index\n\n`;
  indexContent += `Generated on: ${new Date().toISOString()}\n\n`;
  
  // List categories and their contracts
  const categories = fs.readdirSync(CONSOLIDATED_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const category of categories.sort()) {
    indexContent += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    
    const files = fs.readdirSync(path.join(CONSOLIDATED_DIR, category))
      .filter(file => file.endsWith('.sol'));
    
    for (const file of files.sort()) {
      indexContent += `- \`${file}\`\n`;
    }
    
    indexContent += '\n';
  }
  
  fs.writeFileSync(path.join(CONSOLIDATED_DIR, 'INDEX.md'), indexContent);
  log(`Created consolidated contract index file`);
}

// Main function
async function main() {
  log('Starting DLOOP contract consolidation process');
  
  // Step 1: Scan for all contract files
  log('\nScanning for Solidity contracts...');
  scanContracts(CONTRACTS_DIR);
  log(`Found ${fileMap.size} unique contract filenames across the project`);
  
  // Step 2: Create category directories
  log('\nCreating category directories...');
  createCategoryDirs();
  
  // Step 3: Find canonical versions
  log('\nIdentifying canonical versions of duplicate contracts...');
  const canonicalFiles = findCanonicalVersions();
  
  // Step 4: Copy files to consolidated structure
  log('\nCopying files to consolidated structure...');
  copyToConsolidated(canonicalFiles);
  
  // Step 5: Create index
  log('\nGenerating contract index...');
  createIndexFile();
  
  log('\nConsolidation complete!');
  log(`See ${LOG_FILE} for full details.`);
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    log(`Error: ${error.message}`);
    process.exit(1);
  });