/**
 * Standalone Test Framework
 * 
 * This utility provides a minimal testing framework for standalone Node.js tests
 * without requiring Mocha or other test runners. It implements the basic describe/it
 * pattern that's familiar to developers, but works in a plain Node.js environment.
 */

const { ethers } = require('ethers');
const assert = require('assert');

// Global test structure
const testSuite = {
  currentDescribe: null,
  describes: [],
  beforeEachFns: [],
  afterEachFns: [],
  beforeAllFns: [],
  afterAllFns: [],
  stats: {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0
  }
};

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m"
  },
  
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m"
  }
};

/**
 * Define a test suite
 * @param {string} description - Description of the test suite
 * @param {Function} fn - Function containing the tests
 */
function describe(description, fn) {
  const parentDescribe = testSuite.currentDescribe;
  const newDescribe = {
    description,
    parent: parentDescribe,
    tests: [],
    describes: [],
    beforeEachFns: [],
    afterEachFns: [],
    beforeAllFns: [],
    afterAllFns: []
  };
  
  if (parentDescribe) {
    parentDescribe.describes.push(newDescribe);
  } else {
    testSuite.describes.push(newDescribe);
  }
  
  const prevDescribe = testSuite.currentDescribe;
  testSuite.currentDescribe = newDescribe;
  
  try {
    fn();
  } finally {
    testSuite.currentDescribe = prevDescribe;
  }
}

/**
 * Define a test case
 * @param {string} description - Description of the test case
 * @param {Function} fn - Test function
 */
function it(description, fn) {
  if (!testSuite.currentDescribe) {
    throw new Error("'it' must be called within a 'describe' block");
  }
  
  testSuite.currentDescribe.tests.push({
    description,
    fn,
    skip: false
  });
  
  testSuite.stats.total++;
}

/**
 * Skip a test case
 * @param {string} description - Description of the test case
 * @param {Function} fn - Test function
 */
it.skip = function(description, fn) {
  if (!testSuite.currentDescribe) {
    throw new Error("'it.skip' must be called within a 'describe' block");
  }
  
  testSuite.currentDescribe.tests.push({
    description,
    fn,
    skip: true
  });
  
  testSuite.stats.skipped++;
  testSuite.stats.total++;
};

/**
 * Run before each test in this describe block
 * @param {Function} fn - Function to run before each test
 */
function beforeEach(fn) {
  if (!testSuite.currentDescribe) {
    throw new Error("'beforeEach' must be called within a 'describe' block");
  }
  
  testSuite.currentDescribe.beforeEachFns.push(fn);
}

/**
 * Run after each test in this describe block
 * @param {Function} fn - Function to run after each test
 */
function afterEach(fn) {
  if (!testSuite.currentDescribe) {
    throw new Error("'afterEach' must be called within a 'describe' block");
  }
  
  testSuite.currentDescribe.afterEachFns.push(fn);
}

/**
 * Run once before all tests in this describe block
 * @param {Function} fn - Function to run before all tests
 */
function before(fn) {
  if (!testSuite.currentDescribe) {
    throw new Error("'before' must be called within a 'describe' block");
  }
  
  testSuite.currentDescribe.beforeAllFns.push(fn);
}

/**
 * Run once after all tests in this describe block
 * @param {Function} fn - Function to run after all tests
 */
function after(fn) {
  if (!testSuite.currentDescribe) {
    throw new Error("'after' must be called within a 'describe' block");
  }
  
  testSuite.currentDescribe.afterAllFns.push(fn);
}

/**
 * Run all beforeEach functions including those from parent describes
 * @param {Object} describe - The describe block
 * @returns {Array<Function>} Array of functions to run
 */
function getBeforeEachFunctions(describe) {
  const fns = [];
  let current = describe;
  
  while (current) {
    fns.unshift(...current.beforeEachFns);
    current = current.parent;
  }
  
  return fns;
}

/**
 * Run all afterEach functions including those from parent describes
 * @param {Object} describe - The describe block
 * @returns {Array<Function>} Array of functions to run
 */
function getAfterEachFunctions(describe) {
  const fns = [];
  let current = describe;
  
  while (current) {
    fns.push(...current.afterEachFns);
    current = current.parent;
  }
  
  return fns;
}

/**
 * Create a context object for test execution
 * @returns {Object} The context object
 */
function createContext() {
  return {};
}

/**
 * Run a single test
 * @param {Object} test - The test to run
 * @param {Object} describe - The describe block containing the test
 * @param {Object} context - The context object
 * @returns {Promise<boolean>} Whether the test passed
 */
async function runTest(test, describe, context) {
  if (test.skip) {
    console.log(`  ${colors.fg.yellow}❯ ${test.description} (SKIPPED)${colors.reset}`);
    return true;
  }
  
  const beforeEachFns = getBeforeEachFunctions(describe);
  const afterEachFns = getAfterEachFunctions(describe);
  
  try {
    for (const fn of beforeEachFns) {
      await fn.call(context);
    }
    
    await test.fn.call(context);
    
    for (const fn of afterEachFns) {
      await fn.call(context);
    }
    
    console.log(`  ${colors.fg.green}✓ ${test.description}${colors.reset}`);
    testSuite.stats.passed++;
    return true;
  } catch (error) {
    console.log(`  ${colors.fg.red}✗ ${test.description}${colors.reset}`);
    console.log(`    ${colors.fg.red}${error.message}${colors.reset}`);
    console.log(`    ${colors.dim}${error.stack.split('\n').slice(1).join('\n')}${colors.reset}`);
    testSuite.stats.failed++;
    return false;
  }
}

/**
 * Run all tests in a describe block recursively
 * @param {Object} describe - The describe block to run
 * @param {string} indent - Indentation for console output
 * @returns {Promise<boolean>} Whether all tests passed
 */
async function runDescribe(describe, indent = '') {
  console.log(`${indent}${colors.bright}${describe.description}${colors.reset}`);
  
  const context = createContext();
  let allPassed = true;
  
  try {
    // Run beforeAll hooks
    for (const fn of describe.beforeAllFns) {
      await fn.call(context);
    }
    
    // Run tests
    for (const test of describe.tests) {
      const passed = await runTest(test, describe, context);
      allPassed = allPassed && passed;
    }
    
    // Run nested describes
    for (const nestedDescribe of describe.describes) {
      const nestedPassed = await runDescribe(nestedDescribe, indent + '  ');
      allPassed = allPassed && nestedPassed;
    }
    
    // Run afterAll hooks
    for (const fn of describe.afterAllFns) {
      await fn.call(context);
    }
  } catch (error) {
    console.log(`${indent}${colors.fg.red}Error in describe: ${error.message}${colors.reset}`);
    console.log(`${indent}${colors.dim}${error.stack.split('\n').slice(1).join('\n')}${colors.reset}`);
    allPassed = false;
  }
  
  return allPassed;
}

/**
 * Run all tests and print a summary
 * @returns {Promise<boolean>} Whether all tests passed
 */
async function runTests() {
  console.log(`${colors.bright}Running tests...${colors.reset}`);
  const startTime = Date.now();
  
  let allPassed = true;
  
  for (const describe of testSuite.describes) {
    const passed = await runDescribe(describe);
    allPassed = allPassed && passed;
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log('\n');
  console.log(
    `${colors.bright}Test Summary: ` +
    `${colors.fg.green}${testSuite.stats.passed} passed${colors.reset}${colors.bright}, ` +
    `${colors.fg.red}${testSuite.stats.failed} failed${colors.reset}${colors.bright}, ` +
    `${colors.fg.yellow}${testSuite.stats.skipped} skipped${colors.reset}${colors.bright}, ` +
    `${testSuite.stats.total} total${colors.reset}`
  );
  console.log(`${colors.dim}Duration: ${duration.toFixed(2)}s${colors.reset}`);
  
  return allPassed;
}

/**
 * Standalone expect implementation
 * @param {any} actual - The actual value
 * @returns {Object} Assertion object
 */
function expect(actual) {
  return {
    to: {
      equal(expected) {
        assert.strictEqual(actual, expected);
      },
      deep: {
        equal(expected) {
          assert.deepStrictEqual(actual, expected);
        }
      },
      be: {
        true() {
          assert.strictEqual(actual, true);
        },
        false() {
          assert.strictEqual(actual, false);
        },
        null() {
          assert.strictEqual(actual, null);
        },
        undefined() {
          assert.strictEqual(actual, undefined);
        },
        greaterThan(expected) {
          assert.ok(actual > expected, `Expected ${actual} to be greater than ${expected}`);
        },
        lessThan(expected) {
          assert.ok(actual < expected, `Expected ${actual} to be less than ${expected}`);
        }
      },
      not: {
        equal(expected) {
          assert.notStrictEqual(actual, expected);
        },
        be: {
          undefined() {
            assert.notStrictEqual(actual, undefined);
          },
          null() {
            assert.notStrictEqual(actual, null);
          }
        }
      },
      exist() {
        assert.ok(actual !== null && actual !== undefined);
      },
      contain(expected) {
        if (typeof actual === 'string') {
          assert.ok(actual.includes(expected), `Expected "${actual}" to contain "${expected}"`);
        } else if (Array.isArray(actual)) {
          assert.ok(actual.includes(expected), `Expected array to contain ${expected}`);
        } else {
          throw new Error('expect(...).to.contain is only valid for strings and arrays');
        }
      },
      match(regex) {
        assert.ok(regex.test(actual), `Expected "${actual}" to match ${regex}`);
      },
      throw(expected) {
        assert.throws(actual, expected);
      }
    }
  };
}

/**
 * Run the tests and exit with the appropriate code
 */
async function run() {
  try {
    const passed = await runTests();
    if (!passed) {
      console.log(`${colors.fg.red}Tests failed${colors.reset}`);
      process.exit(1);
    } else {
      console.log(`${colors.fg.green}All tests passed${colors.reset}`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`${colors.fg.red}Error running tests: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export testing functions
module.exports = {
  describe,
  it,
  before,
  beforeEach,
  after,
  afterEach,
  expect,
  run
};