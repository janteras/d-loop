const fs = require('fs');
const path = require('path');

// Configuration
const MOCKS_DIR = path.join(__dirname, '../../mocks');
const MOCK_PREFIX = 'Mock';

function validateMockNames() {
    const issues = [];
    const files = fs.readdirSync(MOCKS_DIR).filter(file => file.endsWith('.sol'));

    files.forEach(file => {
        if (file === 'BaseMock.sol') return; // Skip base mock
        
        // Check if file starts with Mock prefix
        if (!file.startsWith(MOCK_PREFIX)) {
            issues.push({
                file,
                issue: 'Missing Mock prefix',
                suggestion: `${MOCK_PREFIX}${file}`
            });
        }

        // Check for consistent naming pattern
        if (file.includes('Mock') && !file.startsWith(MOCK_PREFIX)) {
            issues.push({
                file,
                issue: 'Inconsistent Mock prefix placement',
                suggestion: `${MOCK_PREFIX}${file.replace('Mock', '')}`
            });
        }
    });

    return issues;
}

function generateReport() {
    console.log('Mock Contract Standardization Report\n');
    const issues = validateMockNames();

    if (issues.length === 0) {
        console.log('✅ All mock contracts follow the naming convention.');
        return;
    }

    console.log('Issues found:');
    issues.forEach(({ file, issue, suggestion }) => {
        console.log(`\nFile: ${file}`);
        console.log(`Issue: ${issue}`);
        console.log(`Suggested name: ${suggestion}`);
    });
}

// Run the report
generateReport();
