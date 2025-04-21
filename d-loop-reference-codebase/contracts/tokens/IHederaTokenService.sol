// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IHederaTokenService
 * @dev Interface for Hedera Token Service precompiled contract
 */
interface IHederaTokenService {
    // Token types supported by Hedera Token Service
    enum TokenType {
        FUNGIBLE_COMMON,
        NON_FUNGIBLE_UNIQUE,
        FUNGIBLE_UNIQUE
    }

    // Key representations for Hedera
    enum KeyType {
        ADMIN,
        KYC,
        FREEZE,
        WIPE,
        SUPPLY,
        FEE,
        PAUSE
    }

    // Token supply types
    enum TokenSupplyType {
        INFINITE,
        FINITE
    }
    
    // Token Key struct
    struct TokenKey {
        KeyType keyType;
        bytes key;
    }
    
    // Basic token creation properties
    struct HederaToken {
        string name;
        string symbol;
        address treasury;
        string memo;
        TokenType tokenType;
        TokenSupplyType supplyType;
        uint256 maxSupply;
        uint256 initialSupply;
        uint8 decimals;
        bool freezeDefault;
    }

    /**
     * @dev Creates a Hedera token with the provided properties
     * @param token Token properties
     * @param keys Token keys
     * @param initialSupply Initial token supply
     * @return responseCode Response code (0 = SUCCESS)
     * @return tokenAddress Address of the created token
     */
    function createToken(
        HederaToken memory token,
        TokenKey[] memory keys,
        uint256 initialSupply
    ) external returns (int64 responseCode, address tokenAddress);
    
    /**
     * @dev Mints additional tokens
     * @param token Token address
     * @param amount Amount to mint
     * @param metadata Metadata for the minted tokens (mostly for NFTs)
     * @return responseCode Response code (0 = SUCCESS)
     */
    function mintToken(
        address token,
        uint256 amount,
        bytes[] memory metadata
    ) external returns (int64 responseCode);
    
    /**
     * @dev Burns tokens
     * @param token Token address
     * @param amount Amount to burn
     * @param serialNumbers Serial numbers (for NFTs)
     * @return responseCode Response code (0 = SUCCESS)
     */
    function burnToken(
        address token,
        uint256 amount,
        int64[] memory serialNumbers
    ) external returns (int64 responseCode);
    
    /**
     * @dev Associates a token to an account
     * @param account Account to associate the token with
     * @param token Token address
     * @return responseCode Response code (0 = SUCCESS)
     */
    function associateToken(
        address account,
        address token
    ) external returns (int64 responseCode);
    
    /**
     * @dev Dissociates a token from an account
     * @param account Account to dissociate the token from
     * @param token Token address
     * @return responseCode Response code (0 = SUCCESS)
     */
    function dissociateToken(
        address account,
        address token
    ) external returns (int64 responseCode);
    
    /**
     * @dev Transfers tokens between accounts
     * @param token Token address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return responseCode Response code (0 = SUCCESS)
     */
    function transferToken(
        address token,
        address from,
        address to,
        uint256 amount
    ) external returns (int64 responseCode);
    
    /**
     * @dev Gets info about a token
     * @param token Token address
     * @return responseCode Response code (0 = SUCCESS)
     * @return tokenType Token type
     * @return name Token name
     * @return symbol Token symbol
     * @return decimals Token decimals
     * @return totalSupply Total supply
     * @return treasury Treasury account
     */
    function getTokenInfo(
        address token
    ) external returns (
        int64 responseCode,
        TokenType tokenType,
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        address treasury
    );
    
    /**
     * @dev Freezes a token account
     * @param token Token address
     * @param account Account to freeze
     * @return responseCode Response code (0 = SUCCESS)
     */
    function freezeToken(
        address token,
        address account
    ) external returns (int64 responseCode);
    
    /**
     * @dev Unfreezes a token account
     * @param token Token address
     * @param account Account to unfreeze
     * @return responseCode Response code (0 = SUCCESS)
     */
    function unfreezeToken(
        address token,
        address account
    ) external returns (int64 responseCode);
    
    /**
     * @dev Grants KYC to an account for a token
     * @param token Token address
     * @param account Account to grant KYC to
     * @return responseCode Response code (0 = SUCCESS)
     */
    function grantTokenKyc(
        address token,
        address account
    ) external returns (int64 responseCode);
    
    /**
     * @dev Revokes KYC from an account for a token
     * @param token Token address
     * @param account Account to revoke KYC from
     * @return responseCode Response code (0 = SUCCESS)
     */
    function revokeTokenKyc(
        address token,
        address account
    ) external returns (int64 responseCode);
    
    /**
     * @dev Wipes tokens from an account
     * @param token Token address
     * @param account Account to wipe tokens from
     * @param amount Amount to wipe
     * @return responseCode Response code (0 = SUCCESS)
     */
    function wipeTokenAccount(
        address token,
        address account,
        uint256 amount
    ) external returns (int64 responseCode);
    
    /**
     * @dev Pauses a token
     * @param token Token address
     * @return responseCode Response code (0 = SUCCESS)
     */
    function pauseToken(
        address token
    ) external returns (int64 responseCode);
    
    /**
     * @dev Unpauses a token
     * @param token Token address
     * @return responseCode Response code (0 = SUCCESS)
     */
    function unpauseToken(
        address token
    ) external returns (int64 responseCode);
    
    /**
     * @dev Gets the value of a success response code
     * @return The value of SUCCESS (0)
     */
    function SUCCESS() external pure returns (int64);
}