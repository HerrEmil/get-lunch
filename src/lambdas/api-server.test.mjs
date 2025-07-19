/**
 * Unit tests for API Server Lambda Function
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handler } from "./api-server.mjs";

// Mock dependencies
vi.mock("../../cache-manager.mjs", () => ({
  getCachedLunchData: vi.fn(),
  getRestaurantCache: vi.fn(),
}));

vi.mock("../../enhanced-logger.mjs", () => ({
  createRestaurantLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

import { getCachedLunchData } from "../../cache-manager.mjs";
import { createRestaurantLogger } from "../../enhanced-logger.mjs";
import { readFileSync } from "fs";

// Sample test data
const mockLunchData = [
  {
    week: 47,
    weekday: "måndag",
    name: "Grillad kyckling",
    description: "Med potatis och sallad",
    price: 125,
    restaurant: "niagara",
  },
  {
    week: 47,
    weekday: "tisdag",
    name: "Fish and chips",
    description: "Med remouladsås",
    price: 130,
    restaurant: "niagara",
  },
  {
    week: 47,
    weekday: "onsdag",
    name: "Vegetarisk lasagne",
    description: "Med sallad",
    price: 120,
    restaurant: "niagara",
  },
];

const mockHtmlTemplate = `<!doctype html>
<html>
    <head>
        <link
            rel="stylesheet"
            href="https://uicdn.toast.com/grid/latest/tui-grid.css"
        />
        <script src="https://uicdn.toast.com/grid/latest/tui-grid.js"></script>
    </head>
    <body>
        <div id="grid"></div>
    </body>
    <script>
        const lunches = [];
    </script>
</html>\`;

const mockContext = {
  awsRequestId: "test-request-id-123",
};

describe("API Server Lambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFileSync.mockReturnValue(mockHtmlTemplate);
  });

  it("should return HTML with injected lunch data", async () => {
    getCachedLunchData.mockResolvedValue(mockLunchData);
    
    const event = {
      httpMethod: "GET",
      path: "/",
      queryStringParameters: null,
    };

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(result.body).toContain("Grillad kyckling");
  });

  it("should handle errors gracefully", async () => {
    getCachedLunchData.mockRejectedValue(new Error("Test error"));
    
    const event = {
      httpMethod: "GET",
      path: "/",
      queryStringParameters: null,
    };

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain("Något gick fel");
  });
});
