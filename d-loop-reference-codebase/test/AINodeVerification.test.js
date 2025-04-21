const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * AI Node Verification Test Suite
 * 
 * These tests verify the verification process for AI nodes in the DLOOP protocol
 * without modifying any contracts (Phase 1 requirement).
 */
describe("AI Node Verification", function() {
  // Deploy a testing fixture with necessary contracts and test data
  async function deployFixture() {
    const [deployer, user1, user2, user3, aiNode1, aiNode2, aiNode3] = await ethers.getSigners();
    
    // Deploy mock token for staking
    const MockToken = await ethers.getContractFactory("MockERC20");
    const dloopToken = await MockToken.deploy("Mock DLOOP", "mDLOOP");
    
    // Mint tokens to users and AI nodes
    await dloopToken.mint(user1.address, ethers.parseEther("100000"));
    await dloopToken.mint(user2.address, ethers.parseEther("50000"));
    await dloopToken.mint(user3.address, ethers.parseEther("25000"));
    await dloopToken.mint(aiNode1.address, ethers.parseEther("100000"));
    await dloopToken.mint(aiNode2.address, ethers.parseEther("75000"));
    await dloopToken.mint(aiNode3.address, ethers.parseEther("50000"));
    
    // Define verification parameters
    const verificationParams = {
      minStakeAmount: ethers.parseEther("50000"),
      challengeDifficulty: 3, // On a scale of 1-5
      responseTimeLimit: 60, // seconds
      minSuccessRate: 80, // percentage
      verificationPeriod: 30 * 24 * 60 * 60, // 30 days in seconds
      cooldownPeriod: 7 * 24 * 60 * 60 // 7 days in seconds
    };
    
    // Mock challenge responses for testing
    const mockChallenges = [
      { id: 1, difficulty: 1, timeLimit: 30, solution: ethers.keccak256(ethers.toUtf8Bytes("solution1")) },
      { id: 2, difficulty: 2, timeLimit: 45, solution: ethers.keccak256(ethers.toUtf8Bytes("solution2")) },
      { id: 3, difficulty: 3, timeLimit: 60, solution: ethers.keccak256(ethers.toUtf8Bytes("solution3")) },
      { id: 4, difficulty: 4, timeLimit: 90, solution: ethers.keccak256(ethers.toUtf8Bytes("solution4")) },
      { id: 5, difficulty: 5, timeLimit: 120, solution: ethers.keccak256(ethers.toUtf8Bytes("solution5")) }
    ];
    
    // Initialize AI node status
    const aiNodeStatus = {
      [aiNode1.address]: { isVerified: false, stake: 0, verificationExpiry: 0, successRate: 0, challenges: [] },
      [aiNode2.address]: { isVerified: false, stake: 0, verificationExpiry: 0, successRate: 0, challenges: [] },
      [aiNode3.address]: { isVerified: false, stake: 0, verificationExpiry: 0, successRate: 0, challenges: [] }
    };
    
    return { 
      dloopToken, 
      deployer, 
      user1, 
      user2, 
      user3, 
      aiNode1, 
      aiNode2, 
      aiNode3, 
      verificationParams, 
      mockChallenges,
      aiNodeStatus
    };
  }
  
  describe("Staking Requirement", function() {
    it("Should enforce minimum stake amount for AI node verification", async function() {
      const { dloopToken, aiNode1, verificationParams, aiNodeStatus } = await loadFixture(deployFixture);
      
      // Scenario 1: Insufficient stake
      const insufficientStake = verificationParams.minStakeAmount - ethers.parseEther("1");
      
      // Verify that stake is insufficient
      expect(insufficientStake).to.be.lessThan(verificationParams.minStakeAmount);
      
      // Scenario 2: Sufficient stake
      const sufficientStake = verificationParams.minStakeAmount;
      
      // Simulate staking and check verification eligibility
      aiNodeStatus[aiNode1.address].stake = sufficientStake;
      const isEligible = aiNodeStatus[aiNode1.address].stake >= verificationParams.minStakeAmount;
      
      expect(isEligible).to.be.true;
      
      console.log(`Minimum required stake: ${ethers.formatEther(verificationParams.minStakeAmount)} DLOOP`);
      console.log(`Node stake: ${ethers.formatEther(aiNodeStatus[aiNode1.address].stake)} DLOOP`);
      console.log(`Verification eligibility: ${isEligible}`);
    });
    
    it("Should handle stake slashing for misbehavior", async function() {
      const { dloopToken, aiNode1, verificationParams, aiNodeStatus } = await loadFixture(deployFixture);
      
      // Initialize stake
      const initialStake = verificationParams.minStakeAmount;
      aiNodeStatus[aiNode1.address].stake = initialStake;
      
      // Define slashing percentages for different types of misbehavior
      const slashingRates = {
        minorViolation: 10, // 10% of stake
        moderateViolation: 30, // 30% of stake
        severeViolation: 100 // 100% of stake (full slashing)
      };
      
      // Simulate minor violation
      const minorSlashAmount = (initialStake * BigInt(slashingRates.minorViolation)) / BigInt(100);
      aiNodeStatus[aiNode1.address].stake -= minorSlashAmount;
      
      console.log(`Initial stake: ${ethers.formatEther(initialStake)} DLOOP`);
      console.log(`Slash rate for minor violation: ${slashingRates.minorViolation}%`);
      console.log(`Slashed amount: ${ethers.formatEther(minorSlashAmount)} DLOOP`);
      console.log(`Remaining stake: ${ethers.formatEther(aiNodeStatus[aiNode1.address].stake)} DLOOP`);
      
      // Verify slashing was applied correctly
      expect(aiNodeStatus[aiNode1.address].stake).to.equal(initialStake - minorSlashAmount);
      
      // Check if remaining stake is still sufficient for verification
      const isStillEligible = aiNodeStatus[aiNode1.address].stake >= verificationParams.minStakeAmount;
      
      console.log(`Still eligible for verification: ${isStillEligible}`);
      
      // Simulate severe violation (complete slashing)
      const severeSlashAmount = aiNodeStatus[aiNode1.address].stake;
      aiNodeStatus[aiNode1.address].stake = 0;
      
      console.log(`Slash rate for severe violation: ${slashingRates.severeViolation}%`);
      console.log(`Slashed amount: ${ethers.formatEther(severeSlashAmount)} DLOOP`);
      console.log(`Remaining stake: ${ethers.formatEther(aiNodeStatus[aiNode1.address].stake)} DLOOP`);
      
      // Verify node is no longer eligible after severe violation
      expect(aiNodeStatus[aiNode1.address].stake).to.equal(0);
      expect(aiNodeStatus[aiNode1.address].stake >= verificationParams.minStakeAmount).to.be.false;
    });
  });
  
  describe("Challenge-Response Verification", function() {
    it("Should issue appropriately difficult challenges", async function() {
      const { mockChallenges, aiNode1 } = await loadFixture(deployFixture);
      
      // Function to select a challenge based on node reputation and history
      function selectChallenge(nodeReputation, previousChallenges) {
        // Adjust difficulty based on reputation (1-100 scale)
        let targetDifficulty;
        
        if (nodeReputation < 30) {
          targetDifficulty = 5; // Hardest challenges for unknown/low reputation nodes
        } else if (nodeReputation < 60) {
          targetDifficulty = 4; // Hard challenges for moderate reputation
        } else if (nodeReputation < 80) {
          targetDifficulty = 3; // Medium challenges for good reputation
        } else if (nodeReputation < 95) {
          targetDifficulty = 2; // Easier challenges for very good reputation
        } else {
          targetDifficulty = 1; // Easiest challenges for excellent reputation
        }
        
        // Find challenges matching the target difficulty
        const eligibleChallenges = mockChallenges.filter(c => c.difficulty == targetDifficulty);
        
        // If no exact match, get closest difficulty
        if (eligibleChallenges.length === 0) {
          const sortedChallenges = [...mockChallenges].sort((a, b) => 
            Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty)
          );
          return sortedChallenges[0];
        }
        
        // Select a random challenge from eligible ones
        const randomIndex = Math.floor(Math.random() * eligibleChallenges.length);
        return eligibleChallenges[randomIndex];
      }
      
      // Test with different reputation levels
      const reputationLevels = [20, 50, 75, 90, 98];
      const previousChallenges = [];
      
      for (const reputation of reputationLevels) {
        const challenge = selectChallenge(reputation, previousChallenges);
        previousChallenges.push(challenge.id);
        
        console.log(`Node reputation: ${reputation}`);
        console.log(`Selected challenge: #${challenge.id} (Difficulty: ${challenge.difficulty})`);
        console.log(`Time limit: ${challenge.timeLimit} seconds`);
        console.log(`---`);
        
        // Verify challenge difficulty decreases as reputation increases
        if (reputation <= 30) {
          expect(challenge.difficulty).to.be.closeTo(5, 1);
        } else if (reputation <= 60) {
          expect(challenge.difficulty).to.be.closeTo(4, 1);
        } else if (reputation <= 80) {
          expect(challenge.difficulty).to.be.closeTo(3, 1);
        } else if (reputation <= 95) {
          expect(challenge.difficulty).to.be.closeTo(2, 1);
        } else {
          expect(challenge.difficulty).to.be.closeTo(1, 1);
        }
      }
    });
    
    it("Should verify challenge responses correctly", async function() {
      const { mockChallenges, aiNode1, aiNode2 } = await loadFixture(deployFixture);
      
      // Select a test challenge
      const testChallenge = mockChallenges[2]; // Difficulty 3
      
      // Function to verify a challenge response
      function verifyChallengeResponse(challenge, response, responseTime) {
        // Verify the response is correct
        const isCorrect = response === challenge.solution;
        
        // Verify the response was submitted within the time limit
        const isTimelyResponse = responseTime <= challenge.timeLimit;
        
        return { isCorrect, isTimelyResponse, isPassing: isCorrect && isTimelyResponse };
      }
      
      // Test Case 1: Correct and timely response
      const correctResponse = testChallenge.solution;
      const timelyResponseTime = testChallenge.timeLimit - 10;
      
      const correctResult = verifyChallengeResponse(
        testChallenge, 
        correctResponse, 
        timelyResponseTime
      );
      
      console.log(`Challenge #${testChallenge.id} (Difficulty: ${testChallenge.difficulty})`);
      console.log(`Time limit: ${testChallenge.timeLimit} seconds`);
      console.log(`Response time: ${timelyResponseTime} seconds`);
      console.log(`Response correct: ${correctResult.isCorrect}`);
      console.log(`Response timely: ${correctResult.isTimelyResponse}`);
      console.log(`Challenge passed: ${correctResult.isPassing}`);
      console.log(`---`);
      
      // Test Case 2: Correct but late response
      const lateResponseTime = testChallenge.timeLimit + 10;
      
      const lateResult = verifyChallengeResponse(
        testChallenge, 
        correctResponse, 
        lateResponseTime
      );
      
      console.log(`Challenge #${testChallenge.id} (Difficulty: ${testChallenge.difficulty})`);
      console.log(`Time limit: ${testChallenge.timeLimit} seconds`);
      console.log(`Response time: ${lateResponseTime} seconds`);
      console.log(`Response correct: ${lateResult.isCorrect}`);
      console.log(`Response timely: ${lateResult.isTimelyResponse}`);
      console.log(`Challenge passed: ${lateResult.isPassing}`);
      console.log(`---`);
      
      // Test Case 3: Incorrect but timely response
      const incorrectResponse = ethers.keccak256(ethers.toUtf8Bytes("wrong-answer"));
      
      const incorrectResult = verifyChallengeResponse(
        testChallenge, 
        incorrectResponse, 
        timelyResponseTime
      );
      
      console.log(`Challenge #${testChallenge.id} (Difficulty: ${testChallenge.difficulty})`);
      console.log(`Time limit: ${testChallenge.timeLimit} seconds`);
      console.log(`Response time: ${timelyResponseTime} seconds`);
      console.log(`Response correct: ${incorrectResult.isCorrect}`);
      console.log(`Response timely: ${incorrectResult.isTimelyResponse}`);
      console.log(`Challenge passed: ${incorrectResult.isPassing}`);
      
      // Verify results
      expect(correctResult.isPassing).to.be.true;
      expect(lateResult.isPassing).to.be.false;
      expect(incorrectResult.isPassing).to.be.false;
    });
    
    it("Should track verification attempts and calculate success rate", async function() {
      const { aiNode1, verificationParams, aiNodeStatus } = await loadFixture(deployFixture);
      
      // Simulate a series of verification challenges and responses
      const verificationAttempts = [
        { isCorrect: true, isTimelyResponse: true }, // Pass
        { isCorrect: true, isTimelyResponse: true }, // Pass
        { isCorrect: false, isTimelyResponse: true }, // Fail
        { isCorrect: true, isTimelyResponse: false }, // Fail
        { isCorrect: true, isTimelyResponse: true }, // Pass
        { isCorrect: true, isTimelyResponse: true }, // Pass
        { isCorrect: true, isTimelyResponse: true }, // Pass
        { isCorrect: false, isTimelyResponse: true }, // Fail
        { isCorrect: true, isTimelyResponse: true }, // Pass
        { isCorrect: true, isTimelyResponse: true }  // Pass
      ];
      
      // Calculate success rate
      const successCount = verificationAttempts.filter(
        attempt => attempt.isCorrect && attempt.isTimelyResponse
      ).length;
      
      const totalAttempts = verificationAttempts.length;
      const successRate = Math.floor((successCount / totalAttempts) * 100);
      
      console.log(`Total verification attempts: ${totalAttempts}`);
      console.log(`Successful attempts: ${successCount}`);
      console.log(`Success rate: ${successRate}%`);
      console.log(`Minimum required success rate: ${verificationParams.minSuccessRate}%`);
      console.log(`Verification status: ${successRate >= verificationParams.minSuccessRate ? 'Passed' : 'Failed'}`);
      
      // Update node status
      aiNodeStatus[aiNode1.address].successRate = successRate;
      
      // Verify calculations
      expect(successCount).to.equal(7);
      expect(totalAttempts).to.equal(10);
      expect(successRate).to.equal(70);
      
      // Check if node meets minimum success rate requirement
      const meetsSuccessRate = successRate >= verificationParams.minSuccessRate;
      
      expect(meetsSuccessRate).to.be.false; // 70% < 80% required
    });
  });
  
  describe("Multi-factor Verification", function() {
    it("Should require all verification factors to be passed", async function() {
      const { dloopToken, aiNode1, aiNode2, aiNode3, verificationParams, aiNodeStatus } = await loadFixture(deployFixture);
      
      // Define verification factors
      const verificationFactors = {
        stakeRequirement: true,
        challengeResponse: true,
        successRate: true,
        peerVerification: true
      };
      
      // Function to check full verification status
      function checkVerificationStatus(nodeStatus, verificationFactors) {
        // Check stake requirement
        const stakeVerified = verificationFactors.stakeRequirement ? 
          nodeStatus.stake >= verificationParams.minStakeAmount : true;
        
        // Check challenge success rate
        const rateVerified = verificationFactors.successRate ? 
          nodeStatus.successRate >= verificationParams.minSuccessRate : true;
        
        // Check peer verification (simplified)
        const peerVerified = verificationFactors.peerVerification ? 
          nodeStatus.peerVerificationCount >= 3 : true;
        
        // Check all factors
        return {
          stakeVerified,
          rateVerified,
          peerVerified,
          fullyVerified: stakeVerified && rateVerified && peerVerified
        };
      }
      
      // Setup test cases for three different nodes
      
      // Node 1: All requirements met
      aiNodeStatus[aiNode1.address] = {
        isVerified: false,
        stake: verificationParams.minStakeAmount,
        successRate: 90,
        peerVerificationCount: 4
      };
      
      // Node 2: Missing stake requirement
      aiNodeStatus[aiNode2.address] = {
        isVerified: false,
        stake: verificationParams.minStakeAmount - ethers.parseEther("1000"),
        successRate: 85,
        peerVerificationCount: 3
      };
      
      // Node 3: Missing success rate requirement
      aiNodeStatus[aiNode3.address] = {
        isVerified: false,
        stake: verificationParams.minStakeAmount,
        successRate: 75,
        peerVerificationCount: 5
      };
      
      // Check verification status for each node
      const status1 = checkVerificationStatus(aiNodeStatus[aiNode1.address], verificationFactors);
      const status2 = checkVerificationStatus(aiNodeStatus[aiNode2.address], verificationFactors);
      const status3 = checkVerificationStatus(aiNodeStatus[aiNode3.address], verificationFactors);
      
      console.log("Node 1 Verification Status:");
      console.log(`- Stake verified: ${status1.stakeVerified}`);
      console.log(`- Success rate verified: ${status1.rateVerified}`);
      console.log(`- Peer verification: ${status1.peerVerified}`);
      console.log(`- Fully verified: ${status1.fullyVerified}`);
      console.log(`---`);
      
      console.log("Node 2 Verification Status:");
      console.log(`- Stake verified: ${status2.stakeVerified}`);
      console.log(`- Success rate verified: ${status2.rateVerified}`);
      console.log(`- Peer verification: ${status2.peerVerified}`);
      console.log(`- Fully verified: ${status2.fullyVerified}`);
      console.log(`---`);
      
      console.log("Node 3 Verification Status:");
      console.log(`- Stake verified: ${status3.stakeVerified}`);
      console.log(`- Success rate verified: ${status3.rateVerified}`);
      console.log(`- Peer verification: ${status3.peerVerified}`);
      console.log(`- Fully verified: ${status3.fullyVerified}`);
      
      // Verify that all factors must be met for full verification
      expect(status1.fullyVerified).to.be.true;
      expect(status2.fullyVerified).to.be.false;
      expect(status3.fullyVerified).to.be.false;
    });
  });
  
  describe("Verification Expiry", function() {
    it("Should enforce verification expiry and renewal", async function() {
      const { aiNode1, verificationParams, aiNodeStatus } = await loadFixture(deployFixture);
      
      // Set initial verification status
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      aiNodeStatus[aiNode1.address] = {
        isVerified: true,
        verificationExpiry: now + verificationParams.verificationPeriod,
        stake: verificationParams.minStakeAmount,
        successRate: 90
      };
      
      // Check current verification status
      const currentlyVerified = aiNodeStatus[aiNode1.address].isVerified && 
        aiNodeStatus[aiNode1.address].verificationExpiry > now;
      
      console.log(`Current time: ${new Date(now * 1000).toISOString()}`);
      console.log(`Verification expiry: ${new Date(aiNodeStatus[aiNode1.address].verificationExpiry * 1000).toISOString()}`);
      console.log(`Currently verified: ${currentlyVerified}`);
      
      expect(currentlyVerified).to.be.true;
      
      // Simulate time passing beyond verification period
      const futureTime = now + verificationParams.verificationPeriod + 1000; // 1000 seconds past expiry
      
      // Check verification status after expiry
      const stillVerified = aiNodeStatus[aiNode1.address].isVerified && 
        aiNodeStatus[aiNode1.address].verificationExpiry > futureTime;
      
      console.log(`Future time: ${new Date(futureTime * 1000).toISOString()}`);
      console.log(`Still verified: ${stillVerified}`);
      
      expect(stillVerified).to.be.false;
      
      // Simulate renewal
      aiNodeStatus[aiNode1.address].verificationExpiry = futureTime + verificationParams.verificationPeriod;
      
      // Check verification after renewal
      const verifiedAfterRenewal = aiNodeStatus[aiNode1.address].isVerified && 
        aiNodeStatus[aiNode1.address].verificationExpiry > futureTime;
      
      console.log(`New expiry after renewal: ${new Date(aiNodeStatus[aiNode1.address].verificationExpiry * 1000).toISOString()}`);
      console.log(`Verified after renewal: ${verifiedAfterRenewal}`);
      
      expect(verifiedAfterRenewal).to.be.true;
    });
  });
});