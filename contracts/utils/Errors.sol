// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// General errors
error Unauthorized();
error NotAuthorized();
error ProposalNotFound();
error ContractPaused();
error CallerNotOwner();
error VotingPeriodEnded();
error InvalidProposalState();
error VotingBufferNotElapsed();
error VotingPeriodNotEnded();
error VotingEnded();
error VotingNotStarted();
error TimelockPeriodNotElapsed();
error ProposalAlreadyExecuted();
error QuorumNotReached();
error InvalidQuorumRange();
error InvalidVotingPeriod();
error InsufficientVotingPower();
error MajorityNotReached();
error ProposalNotApproved();
error AlreadyVoted();
error ProposalNotActive();
error TokenNotWhitelisted();
error OperationFailed();
error InsufficientFunds();
error CallerNotAdmin();
error ZeroAddress();
error InvalidAssetState();
error AssetNotFound();
error InvalidAmount();
error EmptyName();
error NameAlreadyRegistered();
error AlreadyApproved();
error OperationNotFound();
error AlreadyExecuted();
error InvalidDestination();
error InsufficientBalance();
error TimelockNotExpired();
error InvalidTimelock();
error TimelockRequired();
error OperationInProgress();

// Amount related errors
error AmountExceedsCap();
error InvalidQuality();
error InvalidParticipation();
error CooldownPeriodNotMet();
error InvalidEpochId();
error InvalidShare();
error InsufficientShares();
error FeeExceedsAmount();

// Token related errors
error TokenNonTransferable();
error TokenTransferFailed();
error TransferFailed();
error TransferFromFailed();
error ETHTransferFailed();
error InsufficientAllowance();
error UnsupportedToken();
error ApprovalFailed();

// Asset related errors
error AssetNotActive();
error AssetAlreadyExists();
error InvalidAssetData();
    error MathOverflow();
    error InvalidToken();
    error NoStakedToken();
    error InsufficientStake();
    error InsufficientRemainingStake();
    error InsufficientUnstakedTokens();
    error OptimizationFailed();
    error ReentrancyGuardReentrantCall();
    
    // Validation errors
    error InvalidDistributionPercentages();
    error InvalidFeePercentage();
    error InvalidArrayLengths();
    error InvalidArrayLength();
    error InvalidParameter();
    error InvalidPeriod();
    error InvalidRequirement();
    error ExceedsBatchLimit();
    error InvalidInput();
    error AlreadyInitialized();
    error NotInitialized();
    
    // Fee related errors
    error FeeNotCollected();
    error ExcessiveFeeSetting();
    error UnauthorizedFeeProcessor();
    error InvalidFeeDestination();
    error FeeParameterLocked();
    
    // Node related errors
    error NodeNotRegistered();
    error NodeAlreadyRegistered();
    error InvalidNodeState();
    error NotNodeOwner();
    
    // Chainlink and oracle related errors
    error StalePrice();
    error InvalidOracleData();
    error PriceCannotBeZero();
    error PriceUpdateNotAuthorized();
    error OracleNotInitialized();
    
    // Role management errors
    error RoleAlreadyGranted();
    error RoleNotGranted();
    error InvalidRoleAdmin();
    error RequiresRole();
    
    // Approval and permissions errors
    error ApprovalNotOptimized();
    error NotApproved();
    error ApprovalExpired();
    error PermissionDenied();