// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../identity/IAINodeIdentifier.sol";

/**
 * @title MockAINodeIdentifier
 * @notice Mock implementation of IAINodeIdentifier for testing
 */
contract MockAINodeIdentifier is IAINodeIdentifier {
    // Mapping of addresses to AI node status
    mapping(address => bool) private _isAINode;
    mapping(address => uint256) private _aiNodeTokenIds;
    uint256 private _aiNodeCount;
    
    /**
     * @notice Check if an address is an AI node
     * @param account The address to check
     * @return True if the address is an AI node, false otherwise
     */
    function isAINode(address account) external view override returns (bool) {
        return _isAINode[account];
    }
    
    /**
     * @notice Get the token ID associated with an AI node
     * @param account The address of the AI node
     * @return The token ID of the AI node's SoulboundNFT (0 if not an AI node)
     */
    function getAINodeTokenId(address account) external view override returns (uint256) {
        return _aiNodeTokenIds[account];
    }
    
    /**
     * @notice Get the number of verified AI nodes
     * @return The total number of verified AI nodes
     */
    function getAINodeCount() external view override returns (uint256) {
        return _aiNodeCount;
    }
    
    /**
     * @notice Set the AI node status of an address (for testing only)
     * @param account The address to set
     * @param isAI Whether the address is an AI node
     */
    function setIsAINode(address account, bool isAI) external {
        if (_isAINode[account] != isAI) {
            if (isAI) {
                _aiNodeCount++;
                _aiNodeTokenIds[account] = _aiNodeCount;
            } else {
                _aiNodeCount--;
                _aiNodeTokenIds[account] = 0;
            }
            
            _isAINode[account] = isAI;
        }
    }
    
    /**
     * @notice Set the token ID of an AI node (for testing only)
     * @param account The address of the AI node
     * @param tokenId The token ID to set
     */
    function setAINodeTokenId(address account, uint256 tokenId) external {
        _aiNodeTokenIds[account] = tokenId;
        
        if (tokenId > 0 && !_isAINode[account]) {
            _isAINode[account] = true;
            _aiNodeCount++;
        } else if (tokenId == 0 && _isAINode[account]) {
            _isAINode[account] = false;
            _aiNodeCount--;
        }
    }
}