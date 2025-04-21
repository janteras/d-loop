const fs = require('fs');
const path = require('path');

// Configuration
const MOCKS_DIR = path.join(__dirname, '../../test/mocks');
const MOCK_PREFIX = 'Mock';
const STANDARD_PREFIX = 'Standard';

// Files to rename
const renameMappings = {
    'AssetDAO.sol': 'MockAssetDAO.sol',
    'DAIToken.sol': 'MockDAIToken.sol',
    'FeeCalculator.sol': 'MockFeeCalculator.sol',
    'Treasury.sol': 'MockTreasury.sol',
    'TokenOptimizerTest.sol': 'MockTokenOptimizer.sol'
};

// Directories to create
const directories = [
    'core',
    'fees',
    'governance',
    'identity',
    'token',
    'base'
];

// Mock categorization
const mockCategories = {
    core: ['MockAssetDAO', 'MockProtocolDAO'],
    fees: ['MockFeeCalculator', 'MockFeeProcessor', 'MockTreasury'],
    governance: ['MockAINodeGovernance', 'MockGovernanceRewards'],
    identity: ['MockSoulboundNFT', 'MockAINodeRegistry'],
    token: ['MockDAIToken', 'MockDLoopToken', 'MockTokenOptimizer'],
    base: ['BaseMock']
};

function createDirectories() {
    console.log('Creating mock directories...');
    directories.forEach(dir => {
        const dirPath = path.join(MOCKS_DIR, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
}

function standardizeMockNames() {
    console.log('Standardizing mock names...');
    Object.entries(renameMappings).forEach(([oldName, newName]) => {
        const oldPath = path.join(MOCKS_DIR, oldName);
        const newPath = path.join(MOCKS_DIR, newName);
        
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`Renamed: ${oldName} -> ${newName}`);
        }
    });
}

function categorizeMocks() {
    console.log('Categorizing mock contracts...');
    Object.entries(mockCategories).forEach(([category, mocks]) => {
        const categoryDir = path.join(MOCKS_DIR, category);
        
        mocks.forEach(mockName => {
            const solFile = `${mockName}.sol`;
            const oldPath = path.join(MOCKS_DIR, solFile);
            const newPath = path.join(categoryDir, solFile);
            
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                console.log(`Moved ${solFile} to ${category}/`);
            }
        });
    });
}

function updateImports() {
    console.log('Updating import statements...');
    directories.forEach(dir => {
        const dirPath = path.join(MOCKS_DIR, dir);
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                if (file.endsWith('.sol')) {
                    const filePath = path.join(dirPath, file);
                    let content = fs.readFileSync(filePath, 'utf8');
                    
                    // Update import paths
                    content = content.replace(
                        /import "\.\.\/([^"]+)"/g,
                        'import "../$1"'
                    );
                    
                    fs.writeFileSync(filePath, content);
                    console.log(`Updated imports in: ${dir}/${file}`);
                }
            });
        }
    });
}

function main() {
    console.log('Starting mock standardization...');
    
    // Create directory structure
    createDirectories();
    
    // Standardize mock names
    standardizeMockNames();
    
    // Categorize mocks into directories
    categorizeMocks();
    
    // Update import statements
    updateImports();
    
    console.log('Mock standardization complete!');
}

// Run the script
main();
