// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./base/BaseMock.sol";
import "../interfaces/governance/IProtocolDAO.sol";

/**
 * @title MockProtocolDAO
 * @dev A simple mock implementation of a protocol DAO for testing purposes
 * @notice This contract follows the standard mock pattern using BaseMock
 */
abstract contract MockProtocolDAO is AccessControl, BaseMock, IProtocolDAO {
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");
    bytes32 public constant PROTOCOL_MEMBER_ROLE = keccak256("PROTOCOL_MEMBER_ROLE");
    bytes32 public constant FEE_SETTER_ROLE = keccak256("FEE_SETTER_ROLE");

    // Storage for protocol settings
    mapping(bytes32 => uint256) private protocolSettings;
    mapping(bytes32 => address) private protocolAddresses;
    mapping(bytes32 => bool) private protocolBoolSettings;

    // Events
    event ProtocolSettingUpdated(bytes32 indexed setting, uint256 value);
    event ProtocolAddressUpdated(bytes32 indexed setting, address value);
    event ProtocolBoolSettingUpdated(bytes32 indexed setting, bool value);
    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);

    /**
     * @dev Constructor
     */
    constructor() BaseMock() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROTOCOL_ADMIN_ROLE, msg.sender);
        _grantRole(PROTOCOL_MEMBER_ROLE, msg.sender);
        _grantRole(FEE_SETTER_ROLE, msg.sender);
    }

    /**
     * @dev Set a protocol setting (uint256 value)
     * @param setting Setting identifier
     * @param value Setting value
     */
    function setProtocolSetting(bytes32 setting, uint256 value) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _recordFunctionCall(
            "setProtocolSetting",
            abi.encode(setting, value)
        );
        protocolSettings[setting] = value;
        emit ProtocolSettingUpdated(setting, value);
    }

    /**
     * @dev Get a protocol setting (uint256 value)
     * @param setting Setting identifier
     * @return value Setting value
     */
    function getProtocolSetting(bytes32 setting) external returns (uint256) {
        _recordFunctionCall(
            "getProtocolSetting",
            abi.encode(setting)
        );
        return protocolSettings[setting];
    }

    /**
     * @dev Set a protocol address
     * @param setting Setting identifier
     * @param addr Address value
     */
    function setProtocolAddress(bytes32 setting, address addr) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _recordFunctionCall(
            "setProtocolAddress",
            abi.encode(setting, addr)
        );
        protocolAddresses[setting] = addr;
        emit ProtocolAddressUpdated(setting, addr);
    }

    /**
     * @dev Get a protocol address
     * @param setting Setting identifier
     * @return addr Address value
     */
    function getProtocolAddress(bytes32 setting) external returns (address) {
        _recordFunctionCall(
            "getProtocolAddress",
            abi.encode(setting)
        );
        return protocolAddresses[setting];
    }

    /**
     * @dev Set a protocol boolean setting
     * @param setting Setting identifier
     * @param value Boolean value
     */
    function setProtocolBoolSetting(bytes32 setting, bool value) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _recordFunctionCall(
            "setProtocolBoolSetting",
            abi.encode(setting, value)
        );
        protocolBoolSettings[setting] = value;
        emit ProtocolBoolSettingUpdated(setting, value);
    }

    /**
     * @dev Get a protocol boolean setting
     * @param setting Setting identifier
     * @return value Boolean value
     */
    function getProtocolBoolSetting(bytes32 setting) external returns (bool) {
        _recordFunctionCall(
            "getProtocolBoolSetting",
            abi.encode(setting)
        );
        return protocolBoolSettings[setting];
    }

    /**
     * @dev Add a protocol member
     * @param member Address of the member to add
     */
    function addMember(address member) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _recordFunctionCall(
            "addMember",
            abi.encode(member)
        );
        grantRole(PROTOCOL_MEMBER_ROLE, member);
        emit MemberAdded(member);
    }

    /**
     * @dev Remove a protocol member
     * @param member Address of the member to remove
     */
    function removeMember(address member) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _recordFunctionCall(
            "removeMember",
            abi.encode(member)
        );
        revokeRole(PROTOCOL_MEMBER_ROLE, member);
        emit MemberRemoved(member);
    }

    /**
     * @dev Grant fee setter role
     * @param account Address to grant the role to
     */
    function grantFeeSetterRole(address account) external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _recordFunctionCall(
            "grantFeeSetterRole",
            abi.encode(account)
        );
        grantRole(FEE_SETTER_ROLE, account);
    }

    /**
     * @dev Check if an account is a protocol member
     * @param account Address to check
     * @return True if the account is a protocol member
     */
    function isMember(address account) external returns (bool) {
        _recordFunctionCall(
            "isMember",
            abi.encode(account)
        );
        return hasRole(PROTOCOL_MEMBER_ROLE, account);
    }

    /**
     * @dev Check if an account can set fees
     * @param account Address to check
     * @return True if the account can set fees
     */
    function canSetFees(address account) external returns (bool) {
        _recordFunctionCall(
            "canSetFees",
            abi.encode(account)
        );
        return hasRole(FEE_SETTER_ROLE, account) || hasRole(PROTOCOL_ADMIN_ROLE, account);
    }
    
    /**
     * @dev Submit a proposal to the protocol DAO
     * @param description Description of the proposal
     * @param data Encoded proposal data
     * @return proposalId Unique identifier for the proposal
     */
    function submitProposal(string calldata description, bytes calldata data) external returns (bytes32 proposalId) {
        _recordFunctionCall(
            "submitProposal",
            abi.encode(description, data)
        );
        
        // Generate a unique proposal ID using keccak256
        proposalId = keccak256(abi.encodePacked(msg.sender, description, block.timestamp));
        
        return proposalId;
    }
    
    /**
     * @dev Get the protocol configuration
     * @return A struct containing protocol configuration parameters
     */
    function getConfig() external returns (ProtocolConfig memory) {
        _recordFunctionCall("getConfig", "");
        
        // Return a mock configuration
        return ProtocolConfig({
            minStake: 1000 ether,
            votingPeriod: 3 days,
            executionDelay: 1 days,
            quorumPercentage: 5100, // 51%
            proposalThreshold: 100 ether
        });
    }
    
    /**
     * @dev Get details about a specific proposal
     * @param proposalId ID of the proposal
     * @return A struct containing proposal details
     */
    function getProposal(bytes32 proposalId) external returns (Proposal memory) {
        _recordFunctionCall(
            "getProposal",
            abi.encode(proposalId)
        );
        
        // Return mock proposal data
        return Proposal({
            id: proposalId,
            proposer: address(0x123),
            description: "Mock proposal",
            status: ProposalStatus.Active,
            forVotes: 100 ether,
            againstVotes: 50 ether,
            startTime: block.timestamp - 1 days,
            endTime: block.timestamp + 2 days,
            executionTime: block.timestamp + 3 days
        });
    }
    
    /**
     * @dev Check if an address has voted on a proposal
     * @param proposalId ID of the proposal
     * @param voter Address of the voter
     * @return Whether the address has voted
     */
    function hasVoted(bytes32 proposalId, address voter) external returns (bool) {
        _recordFunctionCall(
            "hasVoted",
            abi.encode(proposalId, voter)
        );
        
        // Mock implementation - always return false
        return false;
    }
    
    // Role management constants
    
    
    // Proposal status enum
    enum ProposalStatus { Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed }
    
    // Protocol configuration struct
    struct ProtocolConfig {
        uint256 minStake;
        uint256 votingPeriod;
        uint256 executionDelay;
        uint256 quorumPercentage;
        uint256 proposalThreshold;
    }
    
    // Proposal struct
    struct Proposal {
        bytes32 id;
        address proposer;
        string description;
        ProposalStatus status;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 executionTime;
    }
}