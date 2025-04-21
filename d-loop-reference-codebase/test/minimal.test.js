const { expect } = require("chai");

describe("Minimal Test", function () {
  it("should pass a simple test", async function () {
    expect(1 + 1).to.equal(2);
  });
});