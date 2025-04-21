const fs = require('fs');
const path = require('path');

// Directories
const rootInterfacesDir = path.join(__dirname, '..', 'interfaces');
const contractInterfacesDir = path.join(__dirname, '..', 'contracts', 'interfaces');

// Interface mapping (canonical source -> target location)
const interfaceMapping = {
    'IAINodeRegistry.sol': 'core/IAINodeRegistry.sol',
    'IERC20.sol': 'tokens/IERC20.sol',
    'IFeeCalculator.sol': 'fees/IFeeCalculator.sol',
    'IFeeProcessor.sol': 'fees/IFeeProcessor.sol',
    'IFeeSystem.sol': 'fees/IFeeSystem.sol',
    'IPriceOracle.sol': 'oracle/IPriceOracle.sol',
    'IProtocolDAO.sol': 'governance/IProtocolDAO.sol',
    'ISoulboundNFT.sol': 'tokens/ISoulboundNFT.sol',
    'ITokenApprovalOptimizer.sol': 'tokens/ITokenApprovalOptimizer.sol'
};

// Create necessary directories
function createDirectories() {
    const directories = [
        path.join(contractInterfacesDir, 'core'),
        path.join(contractInterfacesDir, 'fees'),
        path.join(contractInterfacesDir, 'governance'),
        path.join(contractInterfacesDir, 'oracle'),
        path.join(contractInterfacesDir, 'tokens')
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Copy interfaces to their new locations
function copyInterfaces() {
    Object.entries(interfaceMapping).forEach(([source, target]) => {
        const sourcePath = path.join(rootInterfacesDir, source);
        const targetPath = path.join(contractInterfacesDir, target);

        if (fs.existsSync(sourcePath)) {
            const content = fs.readFileSync(sourcePath, 'utf8');
            fs.writeFileSync(targetPath, content);
            console.log(`Copied ${source} to ${target}`);
        } else {
            console.log(`Warning: Source file ${source} not found`);
        }
    });
}

// Update import statements in contract files
function updateImports() {
    const contractsDir = path.join(__dirname, '..', 'contracts');
    
    function processFile(filePath) {
        if (!filePath.endsWith('.sol')) return;

        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Update import paths
        Object.entries(interfaceMapping).forEach(([source, target]) => {
            const oldImport = `import "../interfaces/${source}";`;
            const newImport = `import "../interfaces/${target}";`;
            if (content.includes(oldImport)) {
                content = content.replace(oldImport, newImport);
                modified = true;
            }
        });

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated imports in ${filePath}`);
        }
    }

    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                walkDir(filePath);
            } else {
                processFile(filePath);
            }
        });
    }

    walkDir(contractsDir);
}

// Main execution
function main() {
    console.log('Starting interface consolidation...');
    createDirectories();
    copyInterfaces();
    updateImports();
    console.log('Interface consolidation complete!');
}

main();
