import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveCacheConfig } from "./data-collector.mjs";

const ORIGINAL_ENV = { ...process.env };

describe("resolveCacheConfig", () => {
  beforeEach(() => {
    Object.keys(process.env).forEach((key) => delete process.env[key]);
    Object.assign(process.env, ORIGINAL_ENV);
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => delete process.env[key]);
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("prefers LUNCH_CACHE_TABLE when provided", () => {
    process.env.LUNCH_CACHE_TABLE = "cache-table";
    process.env.LUNCH_TABLE_NAME = "legacy-name";

    const config = resolveCacheConfig();

    expect(config.tableName).toBe("cache-table");
    expect(config.ttlHours).toBe(168);
  });

  it("falls back to legacy LUNCH_TABLE_NAME when cache table is absent", () => {
    delete process.env.LUNCH_CACHE_TABLE;
    process.env.LUNCH_TABLE_NAME = "legacy-name";

    const config = resolveCacheConfig();

    expect(config.tableName).toBe("legacy-name");
  });

  it("uses default when no environment variables are set", () => {
    delete process.env.LUNCH_CACHE_TABLE;
    delete process.env.LUNCH_TABLE_NAME;

    const config = resolveCacheConfig();

    expect(config.tableName).toBe("lunch-data");
  });
});
