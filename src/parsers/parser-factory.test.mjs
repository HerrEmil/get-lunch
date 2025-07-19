/**
 * Unit Tests for Parser Factory
 * Tests parser registration, circuit breaker, health monitoring, and error handling
 */

import { createRestaurantLogger } from "../../enhanced-logger.mjs";
import { ParserFactory } from "./parser-factory.mjs";
import { BaseParser } from "./base-parser.mjs";
import { NiagaraParser } from "./niagara-parser.mjs";

// Mock logger to avoid console output during tests
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

// Override logger creation for tests
const originalCreateLogger = createRestaurantLogger;
const createTestLogger = () => mockLogger;

// Mock parser class for testing
class MockParser extends BaseParser {
  constructor(config) {
    super(config);
    this.shouldFail = config.shouldFail || false;
    this.executeDelay = config.executeDelay || 0;
  }

  async parseMenu() {
    if (this.executeDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.executeDelay));
    }

    if (this.shouldFail) {
      throw new Error("Mock parser failure");
    }

    return [
      {
        name: "Mock Lunch",
        description: "A test lunch item",
        price: 125,
        weekday: "måndag",
        week: 45,
        place: this.config.name || "Mock Restaurant",
      },
    ];
  }

  getName() {
    return this.config.name || "Mock Restaurant";
  }

  getUrl() {
    return this.config.url || "https://mock-restaurant.se";
  }
}

// Test helper functions
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${message} - Expected: ${expected}, Actual: ${actual}`,
    );
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    throw new Error(`Expected function to throw: ${message}`);
  } catch (error) {
    if (error.message.startsWith("Expected function to throw")) {
      throw error;
    }
    // Function threw as expected
  }
}

// Test runner
async function runTest(testName, testFn) {
  try {
    console.log(`--- ${testName} ---`);
    await testFn();
    console.log("✅ PASSED");
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function runTestSuite(suiteName, tests) {
  console.log(`\n🧪 TEST SUITE: ${suiteName}`);
  console.log("=".repeat(50));

  let passed = 0;
  let total = 0;

  for (const [testName, testFn] of tests) {
    total++;
    if (await runTest(testName, testFn)) {
      passed++;
    }
  }

  console.log(`\nSuite Results: ${passed}/${total} tests passed`);
  return passed === total;
}

// Test suites
async function testParserRegistration() {
  const tests = [
    [
      "should register parser class successfully",
      async () => {
        const factory = new ParserFactory({
          healthCheck: { enabled: false },
          circuitBreaker: { enabled: true, failureThreshold: 3, timeout: 1000 },
        });

        const result = factory.registerParserClass("mock", MockParser);
        assert(result === true, "Registration should succeed");
        assert(
          factory.parserClasses.has("mock"),
          "Parser class should be registered",
        );

        factory.destroy();
      },
    ],

    [
      "should fail to register invalid parser class",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });

        const result = factory.registerParserClass("invalid", null);
        assert(result === false, "Registration should fail for null class");

        factory.destroy();
      },
    ],

    [
      "should register built-in Niagara parser by default",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });

        assert(
          factory.parserClasses.has("niagara"),
          "Niagara parser should be registered by default",
        );

        factory.destroy();
      },
    ],
  ];

  return await runTestSuite("Parser Registration", tests);
}

async function testParserCreation() {
  const tests = [
    [
      "should create parser instance successfully",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);

        const config = {
          id: "test-restaurant",
          name: "Test Restaurant",
          parser: "mock",
          url: "https://test-restaurant.se",
        };

        const parser = factory.createParser(config);
        assert(
          parser instanceof MockParser,
          "Should create MockParser instance",
        );
        assert(
          factory.parsers.has("test-restaurant"),
          "Parser should be stored",
        );

        factory.destroy();
      },
    ],

    [
      "should fail to create parser with missing config",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);

        const config = {
          id: "incomplete",
          url: "https://test.se",
          // Missing name and parser type
        };

        const parser = factory.createParser(config);
        assert(parser === null, "Should return null for incomplete config");

        factory.destroy();
      },
    ],

    [
      "should initialize circuit breaker for created parser",
      async () => {
        const factory = new ParserFactory({
          healthCheck: { enabled: false },
          circuitBreaker: { enabled: true, failureThreshold: 3, timeout: 1000 },
        });
        factory.registerParserClass("mock", MockParser);

        const config = {
          id: "circuit-test",
          name: "Circuit Test Restaurant",
          parser: "mock",
          url: "https://test.se",
        };

        factory.createParser(config);
        assert(
          factory.circuitBreakers.has("circuit-test"),
          "Circuit breaker should be initialized",
        );

        const breaker = factory.circuitBreakers.get("circuit-test");
        assertEquals(
          breaker.state,
          "closed",
          "Circuit breaker should start closed",
        );
        assertEquals(
          breaker.failureCount,
          0,
          "Failure count should start at 0",
        );

        factory.destroy();
      },
    ],
  ];

  return await runTestSuite("Parser Creation", tests);
}

async function testParserExecution() {
  const tests = [
    [
      "should execute parser successfully",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "success-restaurant",
          name: "Success Restaurant",
          parser: "mock",
          url: "https://success.se",
        });

        const result = await factory.executeParser("success-restaurant");

        assert(result.success === true, "Execution should succeed");
        assert(result.lunches.length === 1, "Should return one lunch item");
        assert(
          result.lunches[0].name === "Mock Lunch",
          "Should return correct lunch data",
        );

        // Check stats update
        const parserData = factory.parsers.get("success-restaurant");
        assertEquals(
          parserData.stats.totalRequests,
          1,
          "Total requests should be 1",
        );
        assertEquals(
          parserData.stats.successfulRequests,
          1,
          "Successful requests should be 1",
        );

        factory.destroy();
      },
    ],

    [
      "should handle parser execution failure",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "failing-restaurant",
          name: "Failing Restaurant",
          parser: "mock",
          url: "https://failing.se",
          shouldFail: true,
        });

        const result = await factory.executeParser("failing-restaurant");

        assert(result.success === false, "Execution should fail");
        assert(result.error !== undefined, "Should contain error information");
        assert(
          result.error.message.includes("Mock parser failure"),
          "Should contain correct error message",
        );

        // Check stats update
        const parserData = factory.parsers.get("failing-restaurant");
        assertEquals(
          parserData.stats.totalRequests,
          1,
          "Total requests should be 1",
        );
        assertEquals(
          parserData.stats.failedRequests,
          1,
          "Failed requests should be 1",
        );

        factory.destroy();
      },
    ],

    [
      "should return error for non-existent parser",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });

        const result = await factory.executeParser("non-existent");

        assert(result.success === false, "Execution should fail");
        assert(
          result.error.message.includes("Parser not found"),
          "Should indicate parser not found",
        );

        factory.destroy();
      },
    ],
  ];

  return await runTestSuite("Parser Execution", tests);
}

async function testCircuitBreaker() {
  const tests = [
    [
      "should open circuit breaker after threshold failures",
      async () => {
        const factory = new ParserFactory({
          healthCheck: { enabled: false },
          circuitBreaker: { enabled: true, failureThreshold: 3, timeout: 1000 },
        });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "circuit-restaurant",
          name: "Circuit Restaurant",
          parser: "mock",
          url: "https://circuit.se",
          shouldFail: true,
        });

        // Execute failures up to threshold
        for (let i = 0; i < 3; i++) {
          await factory.executeParser("circuit-restaurant");
        }

        const breaker = factory.circuitBreakers.get("circuit-restaurant");
        assertEquals(breaker.state, "open", "Circuit breaker should be open");
        assertEquals(breaker.failureCount, 3, "Failure count should be 3");

        factory.destroy();
      },
    ],

    [
      "should prevent execution when circuit breaker is open",
      async () => {
        const factory = new ParserFactory({
          healthCheck: { enabled: false },
          circuitBreaker: { enabled: true, failureThreshold: 3, timeout: 1000 },
        });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "circuit-restaurant",
          name: "Circuit Restaurant",
          parser: "mock",
          url: "https://circuit.se",
          shouldFail: true,
        });

        // Trigger circuit breaker opening
        for (let i = 0; i < 3; i++) {
          await factory.executeParser("circuit-restaurant");
        }

        // Attempt execution with open circuit breaker
        const result = await factory.executeParser("circuit-restaurant");
        assert(result.success === false, "Execution should fail");
        assert(
          result.error.message.includes("Circuit breaker is open"),
          "Should indicate circuit breaker is open",
        );

        factory.destroy();
      },
    ],

    [
      "should transition to half-open after timeout",
      async () => {
        const factory = new ParserFactory({
          healthCheck: { enabled: false },
          circuitBreaker: { enabled: true, failureThreshold: 3, timeout: 1000 },
        });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "circuit-restaurant",
          name: "Circuit Restaurant",
          parser: "mock",
          url: "https://circuit.se",
          shouldFail: true,
        });

        // Open circuit breaker
        for (let i = 0; i < 3; i++) {
          await factory.executeParser("circuit-restaurant");
        }

        const breaker = factory.circuitBreakers.get("circuit-restaurant");
        assertEquals(breaker.state, "open", "Circuit breaker should be open");

        // Manually set next attempt time to past (simulate timeout)
        breaker.nextAttemptTime = Date.now() - 1000;

        // Check if can execute (should transition to half-open)
        const canExecute = factory.canExecute("circuit-restaurant");
        assert(canExecute === true, "Should be able to execute after timeout");
        assertEquals(
          breaker.state,
          "half-open",
          "Should transition to half-open",
        );

        factory.destroy();
      },
    ],
  ];

  return await runTestSuite("Circuit Breaker", tests);
}

async function testMultipleParserExecution() {
  const tests = [
    [
      "should execute all parsers in parallel",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);

        // Create multiple parsers
        factory.createParser({
          id: "restaurant-1",
          name: "Restaurant 1",
          parser: "mock",
          url: "https://restaurant1.se",
        });

        factory.createParser({
          id: "restaurant-2",
          name: "Restaurant 2",
          parser: "mock",
          url: "https://restaurant2.se",
        });

        factory.createParser({
          id: "failing-restaurant",
          name: "Failing Restaurant",
          parser: "mock",
          url: "https://failing.se",
          shouldFail: true,
        });

        const results = await factory.executeAllParsers({
          parallel: true,
          continueOnError: true,
        });

        assertEquals(results.length, 3, "Should return 3 results");

        const successfulResults = results.filter((r) => r.success);
        const failedResults = results.filter((r) => !r.success);

        assertEquals(
          successfulResults.length,
          2,
          "Should have 2 successful results",
        );
        assertEquals(failedResults.length, 1, "Should have 1 failed result");

        factory.destroy();
      },
    ],

    [
      "should execute all parsers sequentially",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);

        // Create multiple parsers
        factory.createParser({
          id: "restaurant-1",
          name: "Restaurant 1",
          parser: "mock",
          url: "https://restaurant1.se",
        });

        factory.createParser({
          id: "restaurant-2",
          name: "Restaurant 2",
          parser: "mock",
          url: "https://restaurant2.se",
        });

        const results = await factory.executeAllParsers({
          parallel: false,
          continueOnError: true,
        });

        assertEquals(results.length, 2, "Should return 2 results");
        assert(
          results.every((r) => r.success),
          "All results should be successful",
        );

        factory.destroy();
      },
    ],
  ];

  return await runTestSuite("Multiple Parser Execution", tests);
}

async function testParserManagement() {
  const tests = [
    [
      "should get parser by ID",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "test-restaurant",
          name: "Test Restaurant",
          parser: "mock",
          url: "https://test.se",
        });

        const parser = factory.getParser("test-restaurant");
        assert(
          parser instanceof MockParser,
          "Should return MockParser instance",
        );

        factory.destroy();
      },
    ],

    [
      "should return null for non-existent parser",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });

        const parser = factory.getParser("non-existent");
        assert(parser === null, "Should return null for non-existent parser");

        factory.destroy();
      },
    ],

    [
      "should get all parsers",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "test-restaurant",
          name: "Test Restaurant",
          parser: "mock",
          url: "https://test.se",
        });

        const parsers = factory.getAllParsers();
        assertEquals(parsers.length, 1, "Should return 1 parser");
        assertEquals(
          parsers[0].id,
          "test-restaurant",
          "Should return correct parser ID",
        );
        assertEquals(
          parsers[0].name,
          "Test Restaurant",
          "Should return correct parser name",
        );

        factory.destroy();
      },
    ],

    [
      "should remove parser",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "test-restaurant",
          name: "Test Restaurant",
          parser: "mock",
          url: "https://test.se",
        });

        const removed = factory.removeParser("test-restaurant");
        assert(removed === true, "Should successfully remove parser");
        assert(
          !factory.parsers.has("test-restaurant"),
          "Parser should be removed from registry",
        );
        assert(
          !factory.circuitBreakers.has("test-restaurant"),
          "Circuit breaker should be removed",
        );

        factory.destroy();
      },
    ],
  ];

  return await runTestSuite("Parser Management", tests);
}

async function testConfigurationValidation() {
  const tests = [
    [
      "should validate valid configuration",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);

        const config = {
          id: "valid-restaurant",
          name: "Valid Restaurant",
          parser: "mock",
          url: "https://valid.se",
        };

        const validation = factory.validateParserConfig(config);
        assert(validation.isValid === true, "Configuration should be valid");
        assertEquals(
          validation.errors.length,
          0,
          "Should have no validation errors",
        );

        factory.destroy();
      },
    ],

    [
      "should validate invalid configuration",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });

        const config = {
          name: "Invalid Restaurant",
          // Missing required fields
        };

        const validation = factory.validateParserConfig(config);
        assert(validation.isValid === false, "Configuration should be invalid");
        assert(validation.errors.length > 0, "Should have validation errors");

        const errorMessages = validation.errors.join(" ");
        assert(errorMessages.includes("ID is required"), "Should require ID");
        assert(
          errorMessages.includes("Parser type is required"),
          "Should require parser type",
        );
        assert(errorMessages.includes("URL is required"), "Should require URL");

        factory.destroy();
      },
    ],

    [
      "should validate invalid URL",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });

        const config = {
          id: "test",
          name: "Test",
          parser: "mock",
          url: "not-a-valid-url",
        };

        const validation = factory.validateParserConfig(config);
        assert(validation.isValid === false, "Configuration should be invalid");
        assert(
          validation.errors.some((e) => e.includes("valid URL")),
          "Should validate URL format",
        );

        factory.destroy();
      },
    ],
  ];

  return await runTestSuite("Configuration Validation", tests);
}

async function testStatisticsAndHealth() {
  const tests = [
    [
      "should get factory statistics",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "stats-restaurant",
          name: "Stats Restaurant",
          parser: "mock",
          url: "https://stats.se",
        });

        // Execute parser to generate stats
        await factory.executeParser("stats-restaurant");

        const stats = factory.getFactoryStats();
        assertEquals(stats.totalParsers, 1, "Should report 1 total parser");
        assertEquals(stats.totalRequests, 1, "Should report 1 total request");
        assertEquals(
          stats.successfulRequests,
          1,
          "Should report 1 successful request",
        );
        assertEquals(
          stats.successRate,
          "100.0%",
          "Should report 100% success rate",
        );
        assert(
          stats.registeredParserTypes.includes("mock"),
          "Should include mock parser type",
        );
        assert(
          stats.registeredParserTypes.includes("niagara"),
          "Should include niagara parser type",
        );

        factory.destroy();
      },
    ],

    [
      "should get parser health status",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });
        factory.registerParserClass("mock", MockParser);
        factory.createParser({
          id: "health-restaurant",
          name: "Health Restaurant",
          parser: "mock",
          url: "https://health.se",
        });

        const health = factory.getParserHealth("health-restaurant");
        assert(
          health.hasOwnProperty("isHealthy"),
          "Should have isHealthy property",
        );
        assert(
          health.hasOwnProperty("circuitBreaker"),
          "Should have circuitBreaker property",
        );
        assertEquals(
          health.circuitBreaker.state,
          "closed",
          "Circuit breaker should be closed",
        );

        factory.destroy();
      },
    ],

    [
      "should return unhealthy for non-existent parser",
      async () => {
        const factory = new ParserFactory({ healthCheck: { enabled: false } });

        const health = factory.getParserHealth("non-existent");
        assert(health.isHealthy === false, "Should report as unhealthy");
        assertEquals(health.status, "not_found", "Should indicate not found");

        factory.destroy();
      },
    ],
  ];

  return await runTestSuite("Statistics and Health", tests);
}

// Main test runner
async function runAllTests() {
  console.log("🧪 Parser Factory Unit Tests");
  console.log("=".repeat(60));
  console.log("Running comprehensive tests for the Parser Factory...\n");

  const suiteResults = [];

  suiteResults.push(await testParserRegistration());
  suiteResults.push(await testParserCreation());
  suiteResults.push(await testParserExecution());
  suiteResults.push(await testCircuitBreaker());
  suiteResults.push(await testMultipleParserExecution());
  suiteResults.push(await testParserManagement());
  suiteResults.push(await testConfigurationValidation());
  suiteResults.push(await testStatisticsAndHealth());

  const totalSuites = suiteResults.length;
  const passedSuites = suiteResults.filter((result) => result).length;

  console.log("\n" + "=".repeat(60));
  console.log("🏁 FINAL RESULTS");
  console.log("=".repeat(60));
  console.log(`Test suites: ${passedSuites}/${totalSuites} passed`);

  if (passedSuites === totalSuites) {
    console.log("✅ All tests passed! Parser Factory is working correctly.");
    process.exit(0);
  } else {
    console.log(`❌ ${totalSuites - passedSuites} test suite(s) failed.`);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch((error) => {
    console.error("Test runner error:", error);
    process.exit(1);
  });
}
