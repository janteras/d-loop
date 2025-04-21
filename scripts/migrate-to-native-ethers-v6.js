#!/usr/bin/env node

/**
 * @fileoverview Script to help migrate from ethers-v6-compat.js to native ethers v6 APIs
 * @description This script identifies usage of compatibility layer APIs and suggests
 * native ethers v6 alternatives
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mapping of compatibility layer APIs to native ethers v6 APIs
const API_MAPPINGS = [
  {
    pattern: /ethers\.utils\.parseUnits\s*\(/g,
    replacement: 'ethers.parseUnits(',
    description: 'parseUnits is now a top-level function in ethers v6'
  },
  {
    pattern: /ethers\.utils\.formatUnits\s*\(/g,
    replacement: 'ethers.formatUnits(',
    description: 'formatUnits is now a top-level function in ethers v6'
  },
  {
    pattern: /ethers\.utils\.parseEther\s*\(/g,
    replacement: 'ethers.parseEther(',
    description: 'parseEther is now a top-level function in ethers v6'
  },
  {
    pattern: /ethers\.utils\.formatEther\s*\(/g,
    replacement: 'ethers.formatEther(',
    description: 'formatEther is now a top-level function in ethers v6'
  },
  {
    pattern: /ethers\.utils\.keccak256\s*\(/g,
    replacement: 'ethers.keccak256(',
    description: 'keccak256 is now a top-level function in ethers v6'
  },
  {
    pattern: /ethers\.utils\.toUtf8Bytes\s*\(/g,
    replacement: 'ethers.toUtf8Bytes(',
    description: 'toUtf8Bytes is now a top-level function in ethers v6'
  },
  {
    pattern: /ethers\.utils\.getAddress\s*\(/g,
    replacement: 'ethers.getAddress(',
    description: 'getAddress is now a top-level function in ethers v6'
  },
  {
    pattern: /ethers\.utils\.isAddress\s*\(/g,
    replacement: 'ethers.isAddress(',
    description: 'isAddress is now a top-level function in ethers v6'
  },
  {
    pattern: /ethers\.constants\.AddressZero/g,
    replacement: 'ethers.ZeroAddress',
    description: 'AddressZero is now ZeroAddress in ethers v6'
  },
  {
    pattern: /ethers\.constants\.HashZero/g,
    replacement: 'ethers.ZeroHash',
    description: 'HashZero is now ZeroHash in ethers v6'
  },
  {
    pattern: /ethers\.BigNumber\.from\s*\(/g,
    replacement: 'BigInt(',
    description: 'BigNumber.from() is replaced with native BigInt in ethers v6'
  }
];

// Files to exclude from migration
const EXCLUDED_FILES = [
  'ethers-v6-compat.js',
  'register-ethers-shim.js',
  'ethers-shim-migration-v2.js',
  'migrate-to-native-ethers-v6.js'
];

// Get all JS files in the test directory
function getAllTestFiles() {
  try {
    const output = execSync('find test -type f -name "*.js"').toString();
    return output.split('\n').filter(file => file.trim() !== '');
  } catch (error) {
    console.error('Error getting test files:', error.message);
    return [];
  }
}

// Check if a file contains compatibility layer APIs that can be migrated
function analyzeFile(filePath) {
  // Skip excluded files
  if (EXCLUDED_FILES.some(excluded => filePath.includes(excluded))) {
    return { hasMigrationOpportunities: false };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const opportunities = [];

    for (const mapping of API_MAPPINGS) {
      const matches = content.match(mapping.pattern);
      if (matches) {
        opportunities.push({
          pattern: matches[0],
          replacement: mapping.replacement,
          description: mapping.description,
          count: matches.length
        });
      }
    }

    return {
      hasMigrationOpportunities: opportunities.length > 0,
      opportunities,
      filePath
    };
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error.message);
    return { hasMigrationOpportunities: false };
  }
}

// Migrate a file to use native ethers v6 APIs
function migrateFile(filePath, dryRun = true) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    for (const mapping of API_MAPPINGS) {
      const originalContent = content;
      content = content.replace(mapping.pattern, mapping.replacement);
      
      if (content !== originalContent) {
        modified = true;
      }
    }
    
    if (modified && !dryRun) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return modified;
  } catch (error) {
    console.error(`Error migrating file ${filePath}:`, error.message);
    return false;
  }
}

// Generate a migration report
function generateReport(results) {
  const totalFiles = results.length;
  const filesWithOpportunities = results.filter(result => result.hasMigrationOpportunities).length;
  
  const report = {
    totalFiles,
    filesWithOpportunities,
    opportunitiesByType: {},
    fileDetails: []
  };
  
  // Count opportunities by type
  results.forEach(result => {
    if (result.hasMigrationOpportunities) {
      result.opportunities.forEach(opportunity => {
        const type = opportunity.description;
        if (!report.opportunitiesByType[type]) {
          report.opportunitiesByType[type] = 0;
        }
        report.opportunitiesByType[type] += opportunity.count;
      });
      
      report.fileDetails.push({
        filePath: result.filePath,
        opportunities: result.opportunities
      });
    }
  });
  
  return report;
}

// Print a migration report
function printReport(report) {
  console.log('\n=== Ethers v6 Migration Opportunities Report ===\n');
  console.log(`Total files analyzed: ${report.totalFiles}`);
  console.log(`Files with migration opportunities: ${report.filesWithOpportunities}`);
  
  console.log('\nOpportunities by type:');
  Object.entries(report.opportunitiesByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count} occurrences`);
  });
  
  console.log('\nFiles with migration opportunities:');
  report.fileDetails.forEach(detail => {
    console.log(`\n${detail.filePath}:`);
    detail.opportunities.forEach(opportunity => {
      console.log(`  - Replace "${opportunity.pattern}" with "${opportunity.replacement}" (${opportunity.count} occurrences)`);
    });
  });
  
  console.log('\nTo migrate these files, run:');
  console.log('  node scripts/migrate-to-native-ethers-v6.js --migrate');
}

// Main function
function main() {
  const shouldMigrate = process.argv.includes('--migrate');
  const targetFile = process.argv.find(arg => arg.endsWith('.js') && !arg.includes('migrate-to-native-ethers-v6.js'));
  
  const filesToAnalyze = targetFile ? [targetFile] : getAllTestFiles();
  
  console.log(`Analyzing ${filesToAnalyze.length} files for ethers v6 migration opportunities...`);
  
  const results = filesToAnalyze
    .filter(file => !EXCLUDED_FILES.some(excluded => file.includes(excluded)))
    .map(file => analyzeFile(file));
  
  if (shouldMigrate) {
    console.log('Migrating files to use native ethers v6 APIs...');
    
    let migratedCount = 0;
    
    results.forEach(result => {
      if (result.hasMigrationOpportunities) {
        const migrated = migrateFile(result.filePath, false);
        if (migrated) {
          migratedCount++;
          console.log(`Migrated: ${result.filePath}`);
        }
      }
    });
    
    console.log(`\nMigration complete! ${migratedCount} files were updated.`);
  } else {
    const report = generateReport(results);
    printReport(report);
    
    if (report.filesWithOpportunities > 0) {
      console.log('\nThis was a dry run. No files were modified.');
      console.log('To perform the actual migration, run with --migrate flag:');
      console.log('  node scripts/migrate-to-native-ethers-v6.js --migrate');
    } else {
      console.log('\nNo migration opportunities found!');
    }
  }
}

main();
