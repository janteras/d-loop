// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./SoulboundNFT.sol";

/**
 * @title AINodeIdentifier
 * @dev Manages the verification process for AI nodes in the DLOOP ecosystem
 */
contract AINodeIdentifier is AccessControl, Pausable {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");
    
    // SoulboundNFT contract
    SoulboundNFT public soulboundNFT;
    
    // Node verification requests
    struct VerificationRequest {
        address requester;
        string metadata;
        uint8 nodeType;
        uint256 timestamp;
        uint256 approvals;
        uint256 rejections;
        bool isProcessed;
        bool isApproved;
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteValue;
    }
    
    // Request counter
    uint256 private _requestCounter;
    
    // Request storage
    mapping(uint256 => VerificationRequest) private _verificationRequests;
    
    // Committee configuration
    uint256 public minApprovals;
    uint256 public committeeMemberCount;
    
    // Events
    event VerificationRequested(uint256 requestId, address requester, uint8 nodeType, string metadata);
    event VerificationVoted(uint256 requestId, address voter, bool approved);
    event VerificationCompleted(uint256 requestId, address requester, bool approved, uint256 tokenId);
    event CommitteeConfigUpdated(uint256 minApprovals, uint256 memberCount);
    
    /**
     * @dev Constructor
     * @param admin Address of the admin
     * @param nftContract Address of the SoulboundNFT contract
     * @param initialCommitteeMembers Array of initial committee member addresses
     * @param _minApprovals Minimum number of committee approvals required
     */
    constructor(
        address admin,
        address nftContract,
        address[] memory initialCommitteeMembers,
        uint256 _minApprovals
    ) {
        require(_minApprovals > 0, "AINodeIdentifier: min approvals must be positive");
        require(_minApprovals <= initialCommitteeMembers.length, "AINodeIdentifier: min approvals too high");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        // Set SoulboundNFT contract
        soulboundNFT = SoulboundNFT(nftContract);
        
        // Initialize committee
        for (uint256 i = 0; i < initialCommitteeMembers.length; i++) {
            _grantRole(COMMITTEE_ROLE, initialCommitteeMembers[i]);
        }
        
        // Set configuration
        minApprovals = _minApprovals;
        committeeMemberCount = initialCommitteeMembers.length;
        
        // Initialize request counter
        _requestCounter = 0;
    }
    
    /**
     * @dev Requests verification for a new AI node
     * @param nodeType Type of AI node (1 = governance, 2 = investment)
     * @param metadata Additional metadata about the AI node
     * @return requestId ID of the verification request
     */
    function requestVerification(
        uint8 nodeType,
        string memory metadata
    ) public whenNotPaused returns (uint256) {
        require(nodeType == 1 || nodeType == 2, "AINodeIdentifier: invalid node type");
        
        uint256 requestId = _requestCounter++;
        
        VerificationRequest storage request = _verificationRequests[requestId];
        request.requester = msg.sender;
        request.metadata = metadata;
        request.nodeType = nodeType;
        request.timestamp = block.timestamp;
        request.approvals = 0;
        request.rejections = 0;
        request.isProcessed = false;
        request.isApproved = false;
        
        emit VerificationRequested(requestId, msg.sender, nodeType, metadata);
        
        return requestId;
    }
    
    /**
     * @dev Votes on a verification request (committee members only)
     * @param requestId ID of the verification request
     * @param approve Whether to approve the request
     */
    function voteOnRequest(uint256 requestId, bool approve) public onlyRole(COMMITTEE_ROLE) whenNotPaused {
        VerificationRequest storage request = _verificationRequests[requestId];
        
        require(request.requester != address(0), "AINodeIdentifier: request does not exist");
        require(!request.isProcessed, "AINodeIdentifier: request already processed");
        require(!request.hasVoted[msg.sender], "AINodeIdentifier: already voted");
        
        // Record vote
        request.hasVoted[msg.sender] = true;
        request.voteValue[msg.sender] = approve;
        
        // Update counters
        if (approve) {
            request.approvals++;
        } else {
            request.rejections++;
        }
        
        emit VerificationVoted(requestId, msg.sender, approve);
        
        // Process request if threshold is reached
        if (request.approvals >= minApprovals) {
            _processRequest(requestId, true);
        } else if (request.rejections > committeeMemberCount - minApprovals) {
            // If there are too many rejections, the request can't be approved
            _processRequest(requestId, false);
        }
    }
    
    /**
     * @dev Processes a verification request based on committee votes
     * @param requestId ID of the verification request
     * @param approved Whether the request is approved
     */
    function _processRequest(uint256 requestId, bool approved) internal {
        VerificationRequest storage request = _verificationRequests[requestId];
        
        request.isProcessed = true;
        request.isApproved = approved;
        
        if (approved) {
            // Mint a new soulbound NFT for the verified AI node
            uint256 tokenId = soulboundNFT.mintNode(
                request.requester,
                "",  // Token URI (can be set later)
                request.nodeType,
                request.metadata
            );
            
            // Verify the node
            soulboundNFT.verifyNode(tokenId);
            
            emit VerificationCompleted(requestId, request.requester, true, tokenId);
        } else {
            emit VerificationCompleted(requestId, request.requester, false, 0);
        }
    }
    
    /**
     * @dev Gets the details of a verification request
     * @param requestId ID of the verification request
     * @return requester Address that requested verification
     * @return metadata Additional metadata about the AI node
     * @return nodeType Type of AI node (1 = governance, 2 = investment)
     * @return timestamp Time the request was made
     * @return approvals Number of committee approvals
     * @return rejections Number of committee rejections
     * @return isProcessed Whether the request has been processed
     * @return isApproved Whether the request was approved
     */
    function getRequestDetails(uint256 requestId) public view returns (
        address requester,
        string memory metadata,
        uint8 nodeType,
        uint256 timestamp,
        uint256 approvals,
        uint256 rejections,
        bool isProcessed,
        bool isApproved
    ) {
        VerificationRequest storage request = _verificationRequests[requestId];
        require(request.requester != address(0), "AINodeIdentifier: request does not exist");
        
        return (
            request.requester,
            request.metadata,
            request.nodeType,
            request.timestamp,
            request.approvals,
            request.rejections,
            request.isProcessed,
            request.isApproved
        );
    }
    
    /**
     * @dev Checks if a committee member has voted on a request
     * @param requestId ID of the verification request
     * @param voter Address of the committee member
     * @return hasVoted Whether the committee member has voted
     * @return voteValue The vote value (true = approve, false = reject)
     */
    function checkVote(uint256 requestId, address voter) public view returns (bool hasVoted, bool voteValue) {
        VerificationRequest storage request = _verificationRequests[requestId];
        require(request.requester != address(0), "AINodeIdentifier: request does not exist");
        
        return (request.hasVoted[voter], request.voteValue[voter]);
    }
    
    /**
     * @dev Checks if an address is verified as an AI node of a specific type
     * @param nodeAddress Address to check
     * @param nodeType Type of AI node (1 = governance, 2 = investment)
     * @return isVerified Whether the address is a verified AI node of the specified type
     */
    function isVerifiedAINode(address nodeAddress, uint8 nodeType) public view returns (bool) {
        return soulboundNFT.hasVerifiedNodeOfType(nodeAddress, nodeType);
    }
    
    /**
     * @dev Updates the committee configuration
     * @param _minApprovals New minimum number of approvals required
     */
    function updateCommitteeConfig(uint256 _minApprovals) public onlyRole(ADMIN_ROLE) {
        require(_minApprovals > 0, "AINodeIdentifier: min approvals must be positive");
        require(_minApprovals <= committeeMemberCount, "AINodeIdentifier: min approvals too high");
        
        minApprovals = _minApprovals;
        
        emit CommitteeConfigUpdated(minApprovals, committeeMemberCount);
    }
    
    /**
     * @dev Adds a new committee member
     * @param member Address of the new committee member
     */
    function addCommitteeMember(address member) public onlyRole(ADMIN_ROLE) {
        require(!hasRole(COMMITTEE_ROLE, member), "AINodeIdentifier: already a committee member");
        
        _grantRole(COMMITTEE_ROLE, member);
        committeeMemberCount++;
        
        emit CommitteeConfigUpdated(minApprovals, committeeMemberCount);
    }
    
    /**
     * @dev Removes a committee member
     * @param member Address of the committee member to remove
     */
    function removeCommitteeMember(address member) public onlyRole(ADMIN_ROLE) {
        require(hasRole(COMMITTEE_ROLE, member), "AINodeIdentifier: not a committee member");
        require(committeeMemberCount > minApprovals, "AINodeIdentifier: can't remove member (min approvals)");
        
        _revokeRole(COMMITTEE_ROLE, member);
        committeeMemberCount--;
        
        emit CommitteeConfigUpdated(minApprovals, committeeMemberCount);
    }
    
    /**
     * @dev Sets a new SoulboundNFT contract address
     * @param nftContract Address of the new SoulboundNFT contract
     */
    function setSoulboundNFT(address nftContract) public onlyRole(ADMIN_ROLE) {
        require(nftContract != address(0), "AINodeIdentifier: invalid NFT contract");
        
        soulboundNFT = SoulboundNFT(nftContract);
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() public onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() public onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}