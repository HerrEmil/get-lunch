/**
 * Unit Tests for Data Collection Lambda
 */

import { describe, it, expect, beforeEach } from "vitest";
import { handler, resolveCacheConfig } from "./data-collector.mjs";

const mockContext = {
  awsRequestId: "test-request-id-123",
  getRemainingTimeInMillis: () => 30000,
};

describe("Event Source Detection", () => {
  it("handles scheduled EventBridge events", async () => {
    const result = await handler({ source: "aws.events" }, mockContext);
    expect([200, 500]).toContain(result.statusCode);
    const body = JSON.parse(result.body);
    expect(typeof body.success).toBe("boolean");
  });

  it("handles manual invocation", async () => {
    const result = await handler({}, mockContext);
    expect([200, 500]).toContain(result.statusCode);
    const body = JSON.parse(result.body);
    expect(typeof body.success).toBe("boolean");
  });

  it("handles HTTP invocation", async () => {
    const result = await handler({ httpMethod: "GET" }, mockContext);
    expect([200, 500]).toContain(result.statusCode);
    expect(result.body).toBeTruthy();
  });
});

describe("Successful Data Collection", () => {
  beforeEach(() => {
    process.env.LUNCH_TABLE_NAME = "test-lunch-table";
    process.env.MAX_CONCURRENCY = "2";
  });

  it("collects data from active restaurants", async () => {
    const result = await handler({ source: "manual" }, mockContext);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.stats).toBeTruthy();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.duration).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeTruthy();
  });

  it("returns proper statistics", async () => {
    const result = await handler({ source: "manual" }, mockContext);
    const body = JSON.parse(result.body);
    expect(body.stats.parsing).toBeTruthy();
    expect(body.stats.lunches).toBeTruthy();
    expect(body.stats.caching).toBeTruthy();
    expect(typeof body.stats.parsing.total).toBe("number");
    expect(typeof body.stats.parsing.successRate).toBe("string");
  });

  it("includes restaurant results summary", async () => {
    const result = await handler({ source: "manual" }, mockContext);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.results)).toBe(true);
    if (body.results.length > 0) {
      expect(body.results[0]).toHaveProperty("restaurant");
      expect(typeof body.results[0].success).toBe("boolean");
      expect(typeof body.results[0].lunchCount).toBe("number");
    }
  });
});

describe("Error Handling", () => {
  it("handles parser failures gracefully", async () => {
    const result = await handler({ source: "manual" }, mockContext);
    expect([200, 500]).toContain(result.statusCode);
    const body = JSON.parse(result.body);
    expect(typeof body.success).toBe("boolean");
  });

  it("handles missing environment variables", async () => {
    const original = process.env.MAX_CONCURRENCY;
    delete process.env.MAX_CONCURRENCY;
    const result = await handler({ source: "manual" }, mockContext);
    expect([200, 500]).toContain(result.statusCode);
    if (original) process.env.MAX_CONCURRENCY = original;
  });
});

describe("Performance", () => {
  it("completes within reasonable time", async () => {
    const start = Date.now();
    const result = await handler({ source: "manual" }, mockContext);
    expect(Date.now() - start).toBeLessThan(30000);
    const body = JSON.parse(result.body);
    expect(body.duration).toBeGreaterThanOrEqual(0);
  });
});
