const fs = require('fs');
const path = require('path');

const TEST_ROOT = path.join(__dirname, '../..');
const SCRIPTS_DIR = path.join(TEST_ROOT, 'scripts');

// Categories and their patterns
const TEST_CATEGORIES = {
    unit: ['.unit.', '.basic.', '.test.'],
    integration: ['.integration.', '.extended.'],
    security: ['.security.'],
    performance: ['.gas.', '.performance.'],
    deployment: ['.deploy.']
};

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function suggestCategory(filename) {
    for (const [category, patterns] of Object.entries(TEST_CATEGORIES)) {
        if (patterns.some(pattern => filename.includes(pattern))) {
            return category;
        }
    }
    return 'unit'; // Default category
}

function generateNewName(currentName, category) {
    let baseName = currentName;
    Object.values(TEST_CATEGORIES).flat().forEach(pattern => {
        baseName = baseName.replace(pattern, '.');
    });
    
    baseName = baseName.replace(/\.+/g, '.').replace('.js', '');
    const parts = baseName.split('.');
    return `${parts[0]}.${category}.test.js`;
}

function migrateTests() {
    console.log('Starting test migration...\n');
    
    // Ensure all category directories exist
    Object.keys(TEST_CATEGORIES).forEach(category => {
        const categoryDir = path.join(TEST_ROOT, category);
        ensureDirectoryExists(categoryDir);
    });

    function processFile(filePath) {
        if (filePath.endsWith('.js') && !filePath.includes('utils/')) {
            const relativePath = path.relative(SCRIPTS_DIR, filePath);
            const category = suggestCategory(path.basename(filePath));
            const newName = generateNewName(path.basename(filePath), category);
            const newPath = path.join(TEST_ROOT, category, newName);

            try {
                // Create a copy in the new location
                fs.copyFileSync(filePath, newPath);
                console.log(`✅ Migrated: ${relativePath} -> ${path.relative(TEST_ROOT, newPath)}`);
            } catch (error) {
                console.error(`❌ Error migrating ${relativePath}:`, error.message);
            }
        }
    }

    function processDirectory(currentPath) {
        const files = fs.readdirSync(currentPath);
        files.forEach(file => {
            const filePath = path.join(currentPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                processDirectory(filePath);
            } else {
                processFile(filePath);
            }
        });
    }

    processDirectory(SCRIPTS_DIR);
    console.log('\nTest migration complete!');
}

// Run the migration
migrateTests();
