const fs = require('fs');
const path = require('path');

const MOCKS_DIR = path.join(__dirname, '../../mocks');

// Files to rename
const renameMap = {
    'StandardMockPriceOracle.sol': 'MockStandardPriceOracle.sol',
    'AssetDAO.sol': 'MockAssetDAO.sol',
    'DAIToken.sol': 'MockDAIToken.sol',
    'FeeCalculator.sol': 'MockFeeCalculator.sol',
    'FeeProcessor.sol': 'MockFeeProcessor.sol',
    'TokenApprovalOptimizer.sol': 'MockTokenApprovalOptimizer.sol',
    'TokenOptimizerTest.sol': 'MockTokenOptimizerTest.sol',
    'Treasury.sol': 'MockTreasury.sol'
};

console.log('Starting mock contract renaming...\n');

Object.entries(renameMap).forEach(([oldName, newName]) => {
    const oldPath = path.join(MOCKS_DIR, oldName);
    const newPath = path.join(MOCKS_DIR, newName);

    try {
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`✅ Renamed: ${oldName} -> ${newName}`);
        } else {
            console.log(`⚠️  File not found: ${oldName}`);
        }
    } catch (error) {
        console.error(`❌ Error renaming ${oldName}:`, error.message);
    }
});

console.log('\nMock contract renaming complete!');
