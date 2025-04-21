const { expect } = require("chai");

describe("Simple Test", function() {
  it("Should verify basic assertions work", function() {
    expect(true).to.equal(true);
    expect(false).to.equal(false);
    expect(1).to.be.a('number');
    expect("test").to.be.a('string');
    console.log("Basic assertions are working");
  });

  it("Should verify hardhat runtime is accessible", function() {
    const hre = require("hardhat");
    expect(hre).to.not.equal(undefined);
    console.log("Hardhat runtime environment accessible");
  });
  
  it("Should verify environment variables", function() {
    process.env.TEST_VAR = "test_value";
    expect(process.env.TEST_VAR).to.equal("test_value");
    console.log("Environment variables working properly");
  });
  
  it("Should check if ethers is properly initialized", async function() {
    const { ethers } = require("hardhat");
    console.log("ethers object:", typeof ethers);
    
    try {
      const signers = await ethers.getSigners();
      console.log("Got signers:", signers.length);
      expect(signers.length).to.be.gt(0);
    } catch (error) {
      console.error("Error getting signers:", error.message);
      throw error;
    }
  });
});