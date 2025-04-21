/**
 * @title Update Mock Imports Script
 * @dev Updates imports in test files to use standardized mocks from /test/mocks/
 */
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_DIRS = [
  './test/scripts',
  './test/unit',
  './test/integration'
];
const OLD_IMPORT_PATTERN = /import\s+.*["']\.\.\/\.\.\/contracts\/mocks\/([^"']+)["']/g;
const NEW_IMPORT_PATTERN = 'import "$1" from "../mocks/$1"';

// Utility functions
function findJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...findJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function updateImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updatedContent = content.replace(
    OLD_IMPORT_PATTERN,
    'import "$1" from "../mocks/$1"'
  );
  
  if (content !== updatedContent) {
    fs.writeFileSync(filePath, updatedContent);
    return true;
  }
  
  return false;
}

// Main update logic
function updateMockImports() {
  console.log('Updating mock imports in test files...');
  
  // Find all JS files in test directories
  let jsFiles = [];
  TEST_DIRS.forEach(dir => {
    jsFiles = [...jsFiles, ...findJsFiles(dir)];
  });
  
  console.log(`Found ${jsFiles.length} JS files to check.`);
  
  // Update imports in each file
  let updatedFiles = 0;
  jsFiles.forEach(file => {
    const updated = updateImports(file);
    if (updated) {
      console.log(`✅ Updated imports in ${file}`);
      updatedFiles++;
    }
  });
  
  // Summary
  console.log('\nUpdate Summary:');
  console.log(`- Total JS files checked: ${jsFiles.length}`);
  console.log(`- Files with updated imports: ${updatedFiles}`);
  
  if (updatedFiles === 0) {
    console.log('✅ No files needed updates. All imports are already using the standardized mocks.');
  }
}

// Execute update
updateMockImports();
