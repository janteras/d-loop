const { ethers } = require("hardhat");
const { expect } = require("chai");
const IntegrationTestHelper = require("./helpers/IntegrationTestHelper");

describe("Price Oracle Integration Tests", function() {
    let helper;
    let owner, treasury;
    let mockPriceOracle, priceOracle;

    before(async function() {
        helper = new IntegrationTestHelper();
        await helper.setupTestEnvironment();
        
        ({ owner, treasury } = helper.signers);
        ({ mockPriceOracle, priceOracle } = helper.contracts);
    });

    describe("1. Price Feed Integration", function() {
        it("should handle decimal conversions correctly", async function() {
            const testPrices = [
                { price: "1800.50", decimals: 8 },
                { price: "1750.75", decimals: 8 },
                { price: "2000.00", decimals: 8 }
            ];

            for (const test of testPrices) {
                const price = ethers.parseUnits(test.price, test.decimals);
                await mockPriceOracle.setPrice(price);

                const fetchedPrice = await priceOracle.getLatestPrice();
                expect(fetchedPrice).to.equal(price);

                // Verify human-readable price
                const readablePrice = await priceOracle.getHumanReadablePrice();
                expect(ethers.formatUnits(readablePrice, test.decimals))
                    .to.equal(test.price);
            }
        });

        it("should handle price updates with different decimals", async function() {
            // Test with 6 decimals (like USDC)
            const priceUsdc = ethers.parseUnits("1800", 6);
            await mockPriceOracle.setDecimals(6);
            await mockPriceOracle.setPrice(priceUsdc);

            const fetchedPrice = await priceOracle.getLatestPrice();
            expect(fetchedPrice).to.equal(priceUsdc);
        });
    });

    describe("2. Price Feed Security", function() {
        it("should prevent unauthorized price updates", async function() {
            await expect(
                mockPriceOracle.connect(treasury).setPrice(ethers.parseUnits("2000", 8))
            ).to.be.revertedWith("Unauthorized");
        });

        it("should validate price ranges", async function() {
            // Test extremely high price
            const extremePrice = ethers.parseUnits("1000000", 8); // $1M
            await expect(
                mockPriceOracle.setPrice(extremePrice)
            ).to.be.revertedWith("Invalid price");

            // Test zero price
            await expect(
                mockPriceOracle.setPrice(0)
            ).to.be.revertedWith("Invalid price");
        });
    });

    describe("3. Price Feed Performance", function() {
        it("should handle rapid price updates", async function() {
            const updateCount = 10;
            const basePrice = 1800;

            for (let i = 0; i < updateCount; i++) {
                const price = ethers.parseUnits(
                    (basePrice + i).toString(), 
                    8
                );
                await mockPriceOracle.setPrice(price);

                const fetchedPrice = await priceOracle.getLatestPrice();
                expect(fetchedPrice).to.equal(price);
            }
        });
    });

    describe("4. Price Feed Integration with Other Contracts", function() {
        it("should correctly calculate token values", async function() {
            // Set a known price
            const tokenPrice = ethers.parseUnits("1800", 8);
            await mockPriceOracle.setPrice(tokenPrice);

            // Calculate token value
            const tokenAmount = ethers.parseEther("1"); // 1 token
            const expectedValue = ethers.parseUnits("1800", 8); // $1800

            const calculatedValue = await priceOracle.calculateTokenValue(tokenAmount);
            expect(calculatedValue).to.equal(expectedValue);
        });

        it("should handle price aggregation from multiple sources", async function() {
            // Deploy additional mock price sources
            const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
            const additionalSource = await MockPriceOracle.deploy(
                ethers.parseUnits("1800", 8),
                8
            );

            // Set slightly different prices
            await mockPriceOracle.setPrice(ethers.parseUnits("1800", 8));
            await additionalSource.setPrice(ethers.parseUnits("1810", 8));

            // Add additional source to oracle
            await priceOracle.addPriceSource(await additionalSource.getAddress());

            // Get aggregated price (should be average)
            const aggregatedPrice = await priceOracle.getAggregatedPrice();
            expect(aggregatedPrice).to.equal(ethers.parseUnits("1805", 8));
        });
    });
});
