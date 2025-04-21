const { expect } = require("chai");
const { ethers } = require("hardhat");

// Import ETHv6 shim for compatibility
require('../../../../ethers-v6-shim.stable');

describe("MockProposalSystem", function() {
  let mockProposalSystem;
  let mockToken;
  let mockTarget;
  let owner;
  let voter1;
  let voter2;
  let voter3;
  
  const ProposalType = {
    ParameterChange: 0,
    TokenAllocation: 1,
    AINodeRegistration: 2
  };
  
  const ProposalState = {
    Active: 0,
    Canceled: 1,
    Defeated: 2,
    Succeeded: 3,
    Executed: 4
  };
  
  const DEFAULT_QUORUM = 51; // 51%
  const VOTING_PERIOD = 60 * 60 * 24 * 3; // 3 days
  const EXECUTION_DELAY = 60 * 60 * 24; // 1 day
  
  before(async function() {
    // Get signers
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    
    // Deploy test token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Governance Token", "GOV", ethers.utils.parseEther("1000000"));
    await mockToken.deployed();
    
    // Deploy mock target contract for proposal execution
    const MockTarget = await ethers.getContractFactory("MockTarget");
    mockTarget = await MockTarget.deploy();
    await mockTarget.deployed();
    
    // Distribute tokens to voters
    await mockToken.transfer(voter1.address, ethers.utils.parseEther("10000"));
    await mockToken.transfer(voter2.address, ethers.utils.parseEther("5000"));
    await mockToken.transfer(voter3.address, ethers.utils.parseEther("2000"));
    
    // Deploy MockProposalSystem
    const MockProposalSystem = await ethers.getContractFactory("MockProposalSystem");
    mockProposalSystem = await MockProposalSystem.deploy(
      mockToken.address,
      DEFAULT_QUORUM,
      VOTING_PERIOD,
      EXECUTION_DELAY
    );
    await mockProposalSystem.deployed();
  });
  
  describe("Initialization", function() {
    it("Should initialize with correct parameters", async function() {
      expect(await mockProposalSystem.governanceToken()).to.equal(mockToken.address);
      expect(await mockProposalSystem.quorum()).to.equal(DEFAULT_QUORUM);
      expect(await mockProposalSystem.votingPeriod()).to.equal(VOTING_PERIOD);
      expect(await mockProposalSystem.executionDelay()).to.equal(EXECUTION_DELAY);
      expect(await mockProposalSystem.proposalCount()).to.equal(0);
    });
    
    it("Should assign GOVERNANCE_ROLE to deployer", async function() {
      const GOVERNANCE_ROLE = await mockProposalSystem.GOVERNANCE_ROLE();
      expect(await mockProposalSystem.hasRole(GOVERNANCE_ROLE, owner.address)).to.be.true;
    });
  });
  
  describe("Proposal Creation", function() {
    it("Should create a proposal correctly", async function() {
      // Create a proposal to update a target parameter
      const description = "Update target parameter";
      const targetFunction = "setParameter(uint256)";
      const paramValue = 123;
      const callData = mockTarget.interface.encodeFunctionData(targetFunction, [paramValue]);
      
      // Create proposal
      const tx = await mockProposalSystem.createProposal(
        ProposalType.ParameterChange,
        description,
        mockTarget.address,
        callData
      );
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      expect(event).to.not.be.undefined;
      expect(event.args.proposalId).to.equal(1);
      expect(event.args.proposer).to.equal(owner.address);
      expect(event.args.proposalType).to.equal(ProposalType.ParameterChange);
      expect(event.args.description).to.equal(description);
      
      // Check proposal details
      const proposal = await mockProposalSystem.getProposal(1);
      expect(proposal.id).to.equal(1);
      expect(proposal.proposalType).to.equal(ProposalType.ParameterChange);
      expect(proposal.proposer).to.equal(owner.address);
      expect(proposal.description).to.equal(description);
      expect(proposal.target).to.equal(mockTarget.address);
      expect(proposal.callData).to.equal(callData);
      expect(proposal.forVotes).to.equal(0);
      expect(proposal.againstVotes).to.equal(0);
      expect(proposal.state).to.equal(ProposalState.Active);
      expect(proposal.executed).to.be.false;
    });
    
    it("Should reject proposal with invalid target", async function() {
      await expect(
        mockProposalSystem.createProposal(
          ProposalType.ParameterChange,
          "Invalid target",
          ethers.constants.AddressZero,
          "0x"
        )
      ).to.be.revertedWith("Invalid target address");
    });
  });
  
  describe("Voting", function() {
    it("Should allow voting on active proposals", async function() {
      // Approve tokens for voting
      await mockToken.connect(voter1).approve(mockProposalSystem.address, ethers.utils.parseEther("1000"));
      
      // Cast vote
      const tx = await mockProposalSystem.connect(voter1).castVote(
        1, // proposalId
        true, // support
        ethers.utils.parseEther("1000"), // votingPower
        "I support this proposal" // justification
      );
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "VoteCast");
      expect(event).to.not.be.undefined;
      expect(event.args.proposalId).to.equal(1);
      expect(event.args.voter).to.equal(voter1.address);
      expect(event.args.support).to.be.true;
      expect(event.args.power).to.equal(ethers.utils.parseEther("1000"));
      expect(event.args.justification).to.equal("I support this proposal");
      
      // Check proposal vote count update
      const proposal = await mockProposalSystem.getProposal(1);
      expect(proposal.forVotes).to.equal(ethers.utils.parseEther("1000"));
      expect(proposal.againstVotes).to.equal(0);
      
      // Check vote details
      const vote = await mockProposalSystem.getVoteDetails(1, voter1.address);
      expect(vote.support).to.be.true;
      expect(vote.power).to.equal(ethers.utils.parseEther("1000"));
      expect(vote.justification).to.equal("I support this proposal");
    });
    
    it("Should allow voting against proposals", async function() {
      // Approve tokens for voting
      await mockToken.connect(voter2).approve(mockProposalSystem.address, ethers.utils.parseEther("2000"));
      
      // Cast vote against
      await mockProposalSystem.connect(voter2).castVote(
        1, // proposalId
        false, // against
        ethers.utils.parseEther("2000"), // votingPower
        "I don't support this proposal" // justification
      );
      
      // Check proposal vote count update
      const proposal = await mockProposalSystem.getProposal(1);
      expect(proposal.forVotes).to.equal(ethers.utils.parseEther("1000"));
      expect(proposal.againstVotes).to.equal(ethers.utils.parseEther("2000"));
    });
    
    it("Should prevent double voting", async function() {
      await expect(
        mockProposalSystem.connect(voter1).castVote(
          1, // proposalId
          true, // support
          ethers.utils.parseEther("500"), // votingPower
          "Second vote" // justification
        )
      ).to.be.revertedWith("Already voted");
    });
    
    it("Should prevent voting without sufficient balance", async function() {
      // Try to vote with more tokens than owned
      await mockToken.connect(voter3).approve(mockProposalSystem.address, ethers.utils.parseEther("10000"));
      
      await expect(
        mockProposalSystem.connect(voter3).castVote(
          1, // proposalId
          true, // support
          ethers.utils.parseEther("10000"), // votingPower (more than owned)
          "Too many tokens" // justification
        )
      ).to.be.revertedWith("Insufficient voting power");
    });
  });
  
  describe("Proposal State", function() {
    it("Should report correct proposal state", async function() {
      // Create a new proposal
      await mockProposalSystem.createProposal(
        ProposalType.TokenAllocation,
        "Token allocation proposal",
        mockTarget.address,
        mockTarget.interface.encodeFunctionData("setParameter(uint256)", [456])
      );
      
      // Initial state should be Active
      expect(await mockProposalSystem.getProposalState(2)).to.equal(ProposalState.Active);
      
      // Advance time to end voting period
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // With no votes, the state should be Defeated
      expect(await mockProposalSystem.getProposalState(2)).to.equal(ProposalState.Defeated);
      
      // For proposal 1, it should be Defeated because against > for
      expect(await mockProposalSystem.getProposalState(1)).to.equal(ProposalState.Defeated);
      
      // Create a proposal that will pass
      await mockProposalSystem.createProposal(
        ProposalType.ParameterChange,
        "Passing proposal",
        mockTarget.address,
        mockTarget.interface.encodeFunctionData("setParameter(uint256)", [789])
      );
      
      // Vote overwhelmingly in favor
      await mockToken.approve(mockProposalSystem.address, ethers.utils.parseEther("5000"));
      await mockProposalSystem.castVote(
        3, // proposalId
        true, // support
        ethers.utils.parseEther("5000"), // votingPower
        "Strong support" // justification
      );
      
      // Only a small vote against
      await mockToken.connect(voter3).approve(mockProposalSystem.address, ethers.utils.parseEther("100"));
      await mockProposalSystem.connect(voter3).castVote(
        3, // proposalId
        false, // against
        ethers.utils.parseEther("100"), // votingPower
        "Small opposition" // justification
      );
      
      // Advance time to end voting period
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // This proposal should be Succeeded
      expect(await mockProposalSystem.getProposalState(3)).to.equal(ProposalState.Succeeded);
    });
  });
  
  describe("Proposal Execution", function() {
    it("Should execute successful proposals", async function() {
      // The value we want to set
      const newValue = 789;
      
      // Check initial target value
      expect(await mockTarget.parameter()).to.equal(0);
      
      // Execute the proposal
      await mockProposalSystem.executeProposal(3);
      
      // Check that the proposal is marked as executed
      const proposal = await mockProposalSystem.getProposal(3);
      expect(proposal.executed).to.be.true;
      expect(proposal.state).to.equal(ProposalState.Executed);
      
      // Check that the target parameter was updated
      expect(await mockTarget.parameter()).to.equal(newValue);
      
      // Check state function returns Executed
      expect(await mockProposalSystem.getProposalState(3)).to.equal(ProposalState.Executed);
    });
    
    it("Should prevent executing failed proposals", async function() {
      await expect(
        mockProposalSystem.executeProposal(1) // This proposal was defeated
      ).to.be.revertedWith("Quorum not reached");
    });
    
    it("Should prevent executing already executed proposals", async function() {
      await expect(
        mockProposalSystem.executeProposal(3) // Already executed
      ).to.be.revertedWith("Already executed");
    });
  });
  
  describe("Token Retrieval", function() {
    it("Should allow retrieving locked tokens after voting", async function() {
      // Check initial locked token balance
      expect(await mockProposalSystem.lockedVotingTokens(voter1.address)).to.equal(ethers.utils.parseEther("1000"));
      
      // Check token balances before retrieval
      const initialBalance = await mockToken.balanceOf(voter1.address);
      
      // Retrieve tokens
      await mockProposalSystem.connect(voter1).retrieveVotingTokens(1);
      
      // Verify tokens were returned
      expect(await mockToken.balanceOf(voter1.address)).to.equal(
        initialBalance.add(ethers.utils.parseEther("1000"))
      );
      
      // Verify locked tokens were updated
      expect(await mockProposalSystem.lockedVotingTokens(voter1.address)).to.equal(0);
      
      // Verify vote power is cleared
      const vote = await mockProposalSystem.getVoteDetails(1, voter1.address);
      expect(vote.power).to.equal(0);
    });
    
    it("Should prevent retrieving already retrieved tokens", async function() {
      await expect(
        mockProposalSystem.connect(voter1).retrieveVotingTokens(1)
      ).to.be.revertedWith("No votes to retrieve");
    });
  });
  
  describe("Governance Parameters", function() {
    it("Should allow updating quorum", async function() {
      // Update quorum to 60%
      const tx = await mockProposalSystem.updateQuorum(60);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "QuorumUpdated");
      expect(event).to.not.be.undefined;
      expect(event.args.oldQuorum).to.equal(DEFAULT_QUORUM);
      expect(event.args.newQuorum).to.equal(60);
      
      // Check updated value
      expect(await mockProposalSystem.quorum()).to.equal(60);
    });
    
    it("Should allow updating voting period", async function() {
      // Update voting period to 7 days
      const newVotingPeriod = 60 * 60 * 24 * 7;
      await mockProposalSystem.updateVotingPeriod(newVotingPeriod);
      
      // Check updated value
      expect(await mockProposalSystem.votingPeriod()).to.equal(newVotingPeriod);
    });
    
    it("Should allow updating execution delay", async function() {
      // Update execution delay to 2 days
      const newExecutionDelay = 60 * 60 * 24 * 2;
      await mockProposalSystem.updateExecutionDelay(newExecutionDelay);
      
      // Check updated value
      expect(await mockProposalSystem.executionDelay()).to.equal(newExecutionDelay);
    });
    
    it("Should enforce valid quorum values", async function() {
      // Try invalid quorum values
      await expect(
        mockProposalSystem.updateQuorum(0)
      ).to.be.revertedWith("Invalid quorum range");
      
      await expect(
        mockProposalSystem.updateQuorum(101)
      ).to.be.revertedWith("Invalid quorum range");
    });
  });
  
  describe("Proposal Cancellation", function() {
    it("Should allow governance role to cancel proposals", async function() {
      // Create a new proposal
      await mockProposalSystem.createProposal(
        ProposalType.AINodeRegistration,
        "Register AI node",
        mockTarget.address,
        mockTarget.interface.encodeFunctionData("setParameter(uint256)", [999])
      );
      
      // Cancel the proposal
      const tx = await mockProposalSystem.cancelProposal(4);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCanceled");
      expect(event).to.not.be.undefined;
      expect(event.args.proposalId).to.equal(4);
      
      // Check proposal state
      const proposal = await mockProposalSystem.getProposal(4);
      expect(proposal.state).to.equal(ProposalState.Canceled);
      
      // Check getProposalState returns Canceled
      expect(await mockProposalSystem.getProposalState(4)).to.equal(ProposalState.Canceled);
    });
    
    it("Should prevent executing canceled proposals", async function() {
      await expect(
        mockProposalSystem.executeProposal(4) // This proposal was canceled
      ).to.be.revertedWith("Proposal not active");
    });
  });
});

// Helper contract for testing proposal execution
const MockTargetArtifact = {
  abi: [
    {
      "inputs": [],
      "name": "parameter",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "_value", "type": "uint256"}],
      "name": "setParameter",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ],
  bytecode: "0x608060405234801561001057600080fd5b5060e28061001f6000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80631798d56c1460375780637cf5dab0146051575b600080fd5b603d6069565b6040516048919060a4565b60405180910390f35b6067605c3660046083565b600055565b005b60005481565b60006020828403121560805761080060209182015290565b634e487b7160e01b600052604160045260246000fd5b60006020828403121560945761008060209182015290565b5080825250919050565b602081016101208284016000815291905056fea2646970667358221220d0c7a79bd8e1f504f71d95f12b3649e6354f76361dccfb7d459fbe9d159ed85a64736f6c63430008180033"
};

beforeEach(async function() {
  // Deploy the MockTarget contract for testing if not already deployed
  if (!this.test || !this.test.parent || !this.test.parent.parent || this.test.parent.parent.title !== "MockProposalSystem") {
    return;
  }
  
  if (!global.mockTargetDeployed) {
    const factory = new ethers.ContractFactory(
      MockTargetArtifact.abi,
      MockTargetArtifact.bytecode,
      (await ethers.getSigners())[0]
    );
    global.mockTarget = await factory.deploy();
    await global.mockTarget.deployed();
    global.mockTargetDeployed = true;
  }
});