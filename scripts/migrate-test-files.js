// Script to migrate test files from scripts directory to appropriate test categories
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define source and destination directories
const sourceDir = path.join(__dirname, '../test/scripts');
const destDirs = {
  'core': path.join(__dirname, '../test/unit/core'),
  'fees': path.join(__dirname, '../test/unit/fees'),
  'governance': path.join(__dirname, '../test/unit/governance'),
  'identity': path.join(__dirname, '../test/unit/identity'),
  'approvalPattern': path.join(__dirname, '../test/approvalPattern'),
  'backward-compatibility': path.join(__dirname, '../test/backward-compatibility'),
  'critical': path.join(__dirname, '../test/critical'),
  'integration': path.join(__dirname, '../test/integration')
};

// Ensure destination directories exist
Object.values(destDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Function to migrate files
function migrateFiles(sourceSubDir, destDir) {
  const sourcePath = path.join(sourceDir, sourceSubDir);
  if (!fs.existsSync(sourcePath)) {
    console.log(`Source directory does not exist: ${sourcePath}`);
    return;
  }

  const files = fs.readdirSync(sourcePath);
  
  files.forEach(file => {
    if (file.endsWith('.test.js')) {
      const sourceFull = path.join(sourcePath, file);
      const destFull = path.join(destDir, file);
      
      // Read file content
      let content = fs.readFileSync(sourceFull, 'utf8');
      
      // Update import paths if needed
      content = content.replace(/\.\.\/\.\.\/mocks\//g, '../../../mocks/');
      content = content.replace(/\.\.\/\.\.\/utils\//g, '../../../utils/');
      content = content.replace(/\.\.\/\.\.\/helpers\//g, '../../../helpers/');
      
      // Write to destination
      fs.writeFileSync(destFull, content);
      console.log(`Migrated: ${sourceFull} -> ${destFull}`);
    }
  });
}

// Migrate files for each category
Object.entries(destDirs).forEach(([category, destDir]) => {
  migrateFiles(category, destDir);
});

console.log('Migration completed successfully!');
