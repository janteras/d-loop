module.exports = {
  "root": true,
  "env": {
    "node": true,
    "mocha": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2022
  },
  "rules": {
    // Ethers v6 shim standardization rules
    "no-restricted-modules": ["error", {
      "patterns": [
        {
          "group": [
            "**/ethers-v6-shim*",
            "**/unified-ethers-v6-shim*", 
            "**/improved-ethers-v6-shim*"
          ],
          "message": "Use relative path to ethers-v6-compat.js instead. For example:\n- In test/unit/ use: require(\"../../utils/ethers-v6-compat\")\n- In test/integration/ use: require(\"../utils/ethers-v6-compat\")\n- In test/utils/ use: require(\"./ethers-v6-compat\")"
        }
      ]
    }],
    
    // Encourage migration to native ethers v6 APIs
    "no-restricted-properties": ["warn",
      {
        "object": "ethers.utils",
        "property": "parseUnits",
        "message": "Consider using native ethers v6 API: ethers.parseUnits() instead"
      },
      {
        "object": "ethers.utils",
        "property": "formatUnits",
        "message": "Consider using native ethers v6 API: ethers.formatUnits() instead"
      },
      {
        "object": "ethers.utils",
        "property": "parseEther",
        "message": "Consider using native ethers v6 API: ethers.parseEther() instead"
      },
      {
        "object": "ethers.utils",
        "property": "formatEther",
        "message": "Consider using native ethers v6 API: ethers.formatEther() instead"
      }
    ]
  },
  "overrides": [
    {
      "files": ["**/ethers-v6-compat.js", "**/ethers-shim-migration*.js"],
      "rules": {
        "no-restricted-modules": "off",
        "no-restricted-properties": "off"
      }
    }
  ]
};
