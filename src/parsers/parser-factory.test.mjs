/**
 * Unit Tests for Parser Factory
 */

import { describe, it, expect } from "vitest";
import { ParserFactory } from "./parser-factory.mjs";
import { BaseParser } from "./base-parser.mjs";

class MockParser extends BaseParser {
  constructor(config) {
    super(config);
    this.shouldFail = config.shouldFail || false;
  }

  async parseMenu() {
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

describe("Parser Registration", () => {
  it("registers parser class successfully", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    expect(factory.registerParserClass("mock", MockParser)).toBe(true);
    expect(factory.parserClasses.has("mock")).toBe(true);
    factory.destroy();
  });

  it("fails to register invalid parser class", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    expect(factory.registerParserClass("invalid", null)).toBe(false);
    factory.destroy();
  });

  it("registers built-in Niagara parser by default", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    expect(factory.parserClasses.has("niagara")).toBe(true);
    factory.destroy();
  });
});

describe("Parser Creation", () => {
  it("creates parser instance successfully", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    const parser = factory.createParser({
      id: "test-restaurant",
      name: "Test Restaurant",
      parser: "mock",
      url: "https://test-restaurant.se",
    });
    expect(parser).toBeInstanceOf(MockParser);
    expect(factory.parsers.has("test-restaurant")).toBe(true);
    factory.destroy();
  });

  it("fails with missing config", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    const parser = factory.createParser({ id: "incomplete", url: "https://test.se" });
    expect(parser).toBeNull();
    factory.destroy();
  });

  it("initializes circuit breaker for created parser", () => {
    const factory = new ParserFactory({
      healthCheck: { enabled: false },
      circuitBreaker: { enabled: true, failureThreshold: 3, timeout: 1000 },
    });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({
      id: "circuit-test",
      name: "Circuit Test",
      parser: "mock",
      url: "https://test.se",
    });
    const breaker = factory.circuitBreakers.get("circuit-test");
    expect(breaker.state).toBe("closed");
    expect(breaker.failureCount).toBe(0);
    factory.destroy();
  });
});

describe("Parser Execution", () => {
  it("executes parser successfully", async () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({
      id: "success-restaurant",
      name: "Success Restaurant",
      parser: "mock",
      url: "https://success.se",
    });
    const result = await factory.executeParser("success-restaurant");
    expect(result.success).toBe(true);
    expect(result.lunches).toHaveLength(1);
    expect(result.lunches[0].name).toBe("Mock Lunch");
    const stats = factory.parsers.get("success-restaurant").stats;
    expect(stats.totalRequests).toBe(1);
    expect(stats.successfulRequests).toBe(1);
    factory.destroy();
  });

  it("handles parser execution failure", async () => {
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
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Mock parser failure");
    factory.destroy();
  });

  it("returns error for non-existent parser", async () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    const result = await factory.executeParser("non-existent");
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Parser not found");
    factory.destroy();
  });
});

describe("Circuit Breaker", () => {
  it("opens after threshold failures", async () => {
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
    for (let i = 0; i < 3; i++) {
      await factory.executeParser("circuit-restaurant");
    }
    const breaker = factory.circuitBreakers.get("circuit-restaurant");
    expect(breaker.state).toBe("open");
    expect(breaker.failureCount).toBe(3);
    factory.destroy();
  });

  it("prevents execution when open", async () => {
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
    for (let i = 0; i < 3; i++) {
      await factory.executeParser("circuit-restaurant");
    }
    const result = await factory.executeParser("circuit-restaurant");
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Circuit breaker is open");
    factory.destroy();
  });

  it("transitions to half-open after timeout", async () => {
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
    for (let i = 0; i < 3; i++) {
      await factory.executeParser("circuit-restaurant");
    }
    const breaker = factory.circuitBreakers.get("circuit-restaurant");
    breaker.nextAttemptTime = Date.now() - 1000;
    expect(factory.canExecute("circuit-restaurant")).toBe(true);
    expect(breaker.state).toBe("half-open");
    factory.destroy();
  });
});

describe("Multiple Parser Execution", () => {
  it("executes all parsers in parallel", async () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({ id: "r1", name: "R1", parser: "mock", url: "https://r1.se" });
    factory.createParser({ id: "r2", name: "R2", parser: "mock", url: "https://r2.se" });
    factory.createParser({
      id: "failing",
      name: "Failing",
      parser: "mock",
      url: "https://failing.se",
      shouldFail: true,
    });
    const results = await factory.executeAllParsers({ parallel: true, continueOnError: true });
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.success)).toHaveLength(2);
    expect(results.filter((r) => !r.success)).toHaveLength(1);
    factory.destroy();
  });

  it("executes all parsers sequentially", async () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({ id: "r1", name: "R1", parser: "mock", url: "https://r1.se" });
    factory.createParser({ id: "r2", name: "R2", parser: "mock", url: "https://r2.se" });
    const results = await factory.executeAllParsers({ parallel: false, continueOnError: true });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
    factory.destroy();
  });
});

describe("Parser Management", () => {
  it("gets parser by ID", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({
      id: "test-restaurant",
      name: "Test Restaurant",
      parser: "mock",
      url: "https://test.se",
    });
    expect(factory.getParser("test-restaurant")).toBeInstanceOf(MockParser);
    factory.destroy();
  });

  it("returns null for non-existent parser", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    expect(factory.getParser("non-existent")).toBeNull();
    factory.destroy();
  });

  it("gets all parsers", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({
      id: "test-restaurant",
      name: "Test Restaurant",
      parser: "mock",
      url: "https://test.se",
    });
    const parsers = factory.getAllParsers();
    expect(parsers).toHaveLength(1);
    expect(parsers[0].id).toBe("test-restaurant");
    factory.destroy();
  });

  it("removes parser", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({
      id: "test-restaurant",
      name: "Test Restaurant",
      parser: "mock",
      url: "https://test.se",
    });
    expect(factory.removeParser("test-restaurant")).toBe(true);
    expect(factory.parsers.has("test-restaurant")).toBe(false);
    expect(factory.circuitBreakers.has("test-restaurant")).toBe(false);
    factory.destroy();
  });
});

describe("Configuration Validation", () => {
  it("validates valid configuration", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    const result = factory.validateParserConfig({
      id: "valid",
      name: "Valid",
      parser: "mock",
      url: "https://valid.se",
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    factory.destroy();
  });

  it("validates invalid configuration", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    const result = factory.validateParserConfig({ name: "Invalid" });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toContain("ID is required");
    factory.destroy();
  });

  it("validates invalid URL", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    const result = factory.validateParserConfig({
      id: "test",
      name: "Test",
      parser: "mock",
      url: "not-a-valid-url",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("valid URL"))).toBe(true);
    factory.destroy();
  });
});

describe("Statistics and Health", () => {
  it("gets factory statistics", async () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({
      id: "stats-restaurant",
      name: "Stats Restaurant",
      parser: "mock",
      url: "https://stats.se",
    });
    await factory.executeParser("stats-restaurant");
    const stats = factory.getFactoryStats();
    expect(stats.totalParsers).toBe(1);
    expect(stats.totalRequests).toBe(1);
    expect(stats.successfulRequests).toBe(1);
    expect(stats.successRate).toBe("100.0%");
    expect(stats.registeredParserTypes).toContain("mock");
    expect(stats.registeredParserTypes).toContain("niagara");
    factory.destroy();
  });

  it("gets parser health status", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    factory.registerParserClass("mock", MockParser);
    factory.createParser({
      id: "health-restaurant",
      name: "Health Restaurant",
      parser: "mock",
      url: "https://health.se",
    });
    const health = factory.getParserHealth("health-restaurant");
    expect(health).toHaveProperty("isHealthy");
    expect(health).toHaveProperty("circuitBreaker");
    expect(health.circuitBreaker.state).toBe("closed");
    factory.destroy();
  });

  it("returns unhealthy for non-existent parser", () => {
    const factory = new ParserFactory({ healthCheck: { enabled: false } });
    const health = factory.getParserHealth("non-existent");
    expect(health.isHealthy).toBe(false);
    expect(health.status).toBe("not_found");
    factory.destroy();
  });
});
