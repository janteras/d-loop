const fs = require('fs');
const path = require('path');

// Configuration
const TEST_CATEGORIES = {
    unit: ['.unit.', '.basic.', '.test.'],
    integration: ['.integration.', '.extended.'],
    security: ['.security.'],
    performance: ['.gas.', '.performance.'],
    deployment: ['.deploy.']
};

function suggestCategory(filename) {
    for (const [category, patterns] of Object.entries(TEST_CATEGORIES)) {
        if (patterns.some(pattern => filename.includes(pattern))) {
            return category;
        }
    }
    return 'unit'; // Default category
}

function analyzeTestFiles(directory) {
    const results = {
        suggestions: [],
        stats: {
            total: 0,
            categorized: 0
        }
    };

    function processFile(filePath) {
        if (filePath.endsWith('.js') && !filePath.includes('utils/')) {
            results.stats.total++;
            const relativePath = path.relative(directory, filePath);
            const suggestedCategory = suggestCategory(path.basename(filePath));
            const newName = generateNewName(path.basename(filePath), suggestedCategory);
            
            results.suggestions.push({
                currentPath: relativePath,
                suggestedCategory,
                newName,
                newPath: path.join(suggestedCategory, newName)
            });
            results.stats.categorized++;
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

    processDirectory(directory);
    return results;
}

function generateNewName(currentName, category) {
    // Remove existing patterns
    let baseName = currentName;
    Object.values(TEST_CATEGORIES).flat().forEach(pattern => {
        baseName = baseName.replace(pattern, '.');
    });
    
    // Clean up multiple dots
    baseName = baseName.replace(/\.+/g, '.');
    
    // Remove .js extension
    baseName = baseName.replace('.js', '');
    
    // Generate new name
    const parts = baseName.split('.');
    return `${parts[0]}.${category}.test.js`;
}

function generateReport(directory) {
    console.log('Test Migration Analysis Report\n');
    const results = analyzeTestFiles(directory);

    console.log('Statistics:');
    console.log(`Total test files found: ${results.stats.total}`);
    console.log(`Files categorized: ${results.stats.categorized}`);
    console.log('\nSuggested migrations:');

    const groupedByCategory = {};
    results.suggestions.forEach(suggestion => {
        if (!groupedByCategory[suggestion.suggestedCategory]) {
            groupedByCategory[suggestion.suggestedCategory] = [];
        }
        groupedByCategory[suggestion.suggestedCategory].push(suggestion);
    });

    for (const [category, suggestions] of Object.entries(groupedByCategory)) {
        console.log(`\n${category.toUpperCase()} (${suggestions.length} files):`);
        suggestions.forEach(({ currentPath, newPath }) => {
            console.log(`  ${currentPath} -> ${newPath}`);
        });
    }
}

// Run the report
const testDirectory = path.join(__dirname, '../../scripts');
generateReport(testDirectory);
