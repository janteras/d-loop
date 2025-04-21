// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Errors
 * @dev Library containing standardized errors for the DLOOP protocol
 * This library improves gas efficiency by using custom errors instead of strings
 * It also provides consistent error messages across the protocol
 */
library Errors {
    // General errors
    error ZeroAddress();
    error Unauthorized();
    error AlreadyInitialized();
    error NotInitialized();
    error InvalidParameter();
    error OperationPaused();
    error InvalidState();
    error DeadlineExpired();
    error ContractCallFailed();
    
    // Bridge specific errors
    error BridgeMessageProcessed();
    error BridgeInvalidProof();
    error BridgeInvalidChainId();
    error BridgeUnsupportedChain();
    error BridgeExceedsMaxTransferAmount();
    error BridgeExceedsDailyLimit();
    error BridgeExceedsAssetLimit();
    error BridgeInvalidSignature();
    error BridgeInvalidMessageSize();
    error BridgeFeeTransferFailed();
    error BridgeTokenMintFailed();
    error BridgeTokenBurnFailed();
    
    // Enhanced bridge rate limiting errors
    error BridgeExceedsUserTransferLimit();
    error BridgeExceedsUserDailyLimit();
    error BridgeExceedsUserWeeklyLimit();
    error BridgeCooldownPeriodNotMet();
    error BridgeRateLimitExceeded();
    
    // TokenManager errors
    error TokenNotManaged();
    error TokenAlreadyExists();
    error TokenCreateFailed();
    error TokenTransferFailed();
    error TokenMintFailed();
    error TokenBurnFailed();
    
    // MessageVerifier errors
    error MessageAlreadyProcessed();
    error MessageInvalidProof();
    error MessageInvalidSigner();
    error MessageDeliveryFailed();
    
    // Oracle errors
    error OracleStale();
    error OraclePriceZero();
    error OracleInvalidSource();
    error OracleUnsupportedAsset();
    
    // DAO errors
    error DAOProposalExpired();
    error DAOProposalAlreadyExecuted();
    error DAOProposalNotApproved();
    error DAOInsufficientVotes();
    error DAOInvalidExecutor();
    error DAOInvalidProposal();
    error DAOTimelockActive();
    error DAOExecutionFailed();
    
    // AINode errors
    error AINodeNotRegistered();
    error AINodeAlreadyRegistered();
    error AINodeInvalidProof();
    
    // Fee errors
    error FeeExceedsLimit();
    error FeeCalculationFailed();
    error FeeDistributionFailed();
    
    // Governance errors
    error GovInvalidVote();
    error GovAlreadyVoted();
    error GovVotingClosed();
    error GovInsufficientTokens();
    
    // Asset errors
    error AssetInsufficientBalance();
    error AssetTransferFailed();
    error AssetNotSupported();
    error AssetAlreadySupported();
    
    // RewardDistributor errors
    error RewardInsufficientBalance();
    error RewardDistributionFailed();
    error RewardCalculationFailed();
    
    // Upgradeable contract errors
    error UpgradeInvalidImplementation();
    error UpgradeCallFailed();
}