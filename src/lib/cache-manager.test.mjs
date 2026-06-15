import { describe, expect, it, beforeEach, vi } from "vitest";

// Capture the command objects DynamoDB would receive so we can both drive
// responses (for the read) and assert on writes (Put).
const sendMock = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(function () {}),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => {
  class GetCommand {
    constructor(input) {
      this.input = input;
      this.__type = "Get";
    }
  }
  class PutCommand {
    constructor(input) {
      this.input = input;
      this.__type = "Put";
    }
  }
  class QueryCommand {
    constructor(input) {
      this.input = input;
      this.__type = "Query";
    }
  }
  class DeleteCommand {
    constructor(input) {
      this.input = input;
      this.__type = "Delete";
    }
  }
  class BatchWriteCommand {
    constructor(input) {
      this.input = input;
      this.__type = "BatchWrite";
    }
  }
  class ScanCommand {
    constructor(input) {
      this.input = input;
      this.__type = "Scan";
    }
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send: sendMock }) },
    GetCommand,
    PutCommand,
    QueryCommand,
    DeleteCommand,
    BatchWriteCommand,
    ScanCommand,
  };
});

const { cacheLunchData, initializeDynamoClient } = await import(
  "./cache-manager.mjs"
);

function lunch(weekday, name) {
  return { weekday, name, week: 25, place: "Kontrast", price: 125 };
}

/**
 * Wire the mocked DynamoDB client so a GetCommand returns `existingLunches`
 * and a PutCommand resolves. Returns a helper to read back the item that was
 * written by the PutCommand.
 */
function setupClient(existingLunches) {
  const writes = [];
  sendMock.mockReset();
  sendMock.mockImplementation(async (command) => {
    if (command.__type === "Get") {
      return existingLunches === undefined
        ? {}
        : { Item: { lunches: existingLunches } };
    }
    if (command.__type === "Put") {
      writes.push(command.input.Item);
      return {};
    }
    return {};
  });
  initializeDynamoClient();
  return { writtenItem: () => writes[writes.length - 1] };
}

describe("cacheLunchData merge/accumulate semantics", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("writes the new batch verbatim when nothing is cached yet", async () => {
    const { writtenItem } = setupClient(undefined);
    await cacheLunchData("Kontrast", 25, [lunch("måndag", "Mon dish")]);

    const item = writtenItem();
    expect(item.lunches).toHaveLength(1);
    expect(item.lunches[0]).toMatchObject({ weekday: "måndag" });
    expect(item.lunchCount).toBe(1);
  });

  it("accumulates a new weekday onto the existing week (Kontrast case)", async () => {
    const { writtenItem } = setupClient([lunch("måndag", "Mon dish")]);
    await cacheLunchData("Kontrast", 25, [lunch("tisdag", "Tue dish")]);

    const item = writtenItem();
    expect(item.lunches.map((l) => l.weekday)).toEqual(["måndag", "tisdag"]);
    expect(item.lunchCount).toBe(2);
  });

  it("replaces (does not duplicate) a weekday already present", async () => {
    const { writtenItem } = setupClient([
      lunch("måndag", "Old Mon"),
      lunch("tisdag", "Tue dish"),
    ]);
    await cacheLunchData("Kontrast", 25, [
      lunch("måndag", "New Mon A"),
      lunch("måndag", "New Mon B"),
    ]);

    const item = writtenItem();
    // tisdag preserved; måndag fully swapped for the two new entries
    expect(item.lunches.map((l) => l.name)).toEqual([
      "Tue dish",
      "New Mon A",
      "New Mon B",
    ]);
  });

  it("is a pure overwrite for parsers that publish the whole week at once", async () => {
    const existing = [
      lunch("måndag", "old1"),
      lunch("tisdag", "old2"),
      lunch("onsdag", "old3"),
    ];
    const fresh = [
      lunch("måndag", "new1"),
      lunch("tisdag", "new2"),
      lunch("onsdag", "new3"),
      lunch("torsdag", "new4"),
      lunch("fredag", "new5"),
    ];
    const { writtenItem } = setupClient(existing);
    await cacheLunchData("Niagara", 25, fresh);

    const item = writtenItem();
    expect(item.lunches).toEqual(fresh);
    expect(item.lunchCount).toBe(5);
  });

  it("replaces the weekday-less ('') bucket wholesale", async () => {
    const { writtenItem } = setupClient([lunch("", "old A"), lunch("", "old B")]);
    await cacheLunchData("Spill", 25, [lunch("", "new only")]);

    const item = writtenItem();
    expect(item.lunches.map((l) => l.name)).toEqual(["new only"]);
  });

  it("falls back to the new batch if reading existing data fails", async () => {
    const writes = [];
    sendMock.mockReset();
    sendMock.mockImplementation(async (command) => {
      if (command.__type === "Get") throw new Error("boom");
      if (command.__type === "Put") {
        writes.push(command.input.Item);
        return {};
      }
      return {};
    });
    initializeDynamoClient();

    await cacheLunchData("Kontrast", 25, [lunch("tisdag", "Tue dish")]);
    expect(writes[writes.length - 1].lunches.map((l) => l.weekday)).toEqual([
      "tisdag",
    ]);
  });
});
