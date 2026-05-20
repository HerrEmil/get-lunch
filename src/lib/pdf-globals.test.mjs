import { describe, expect, it } from "vitest";
import { DOMMatrixPolyfill } from "./pdf-globals.mjs";

describe("DOMMatrixPolyfill", () => {
  it("defaults to identity", () => {
    const m = new DOMMatrixPolyfill();
    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([1, 0, 0, 1, 0, 0]);
    expect(m.isIdentity).toBe(true);
    expect(m.is2D).toBe(true);
  });

  it("constructs from a 6-element array", () => {
    const m = new DOMMatrixPolyfill([2, 0, 0, 3, 10, 20]);
    expect([m.a, m.d, m.e, m.f]).toEqual([2, 3, 10, 20]);
  });

  it("translate composes a translation", () => {
    const p = new DOMMatrixPolyfill().translate(5, 7).transformPoint({
      x: 1,
      y: 1,
    });
    expect([p.x, p.y]).toEqual([6, 8]);
  });

  it("scale composes a scaling", () => {
    const p = new DOMMatrixPolyfill()
      .scale(2, 3)
      .transformPoint({ x: 4, y: 5 });
    expect([p.x, p.y]).toEqual([8, 15]);
  });

  it("multiply applies the argument first (translate then scale)", () => {
    // scale(2) * translate(10,0): point (0,0) -> translate -> (10,0) -> scale -> (20,0)
    const m = new DOMMatrixPolyfill([2, 0, 0, 2, 0, 0]).multiply(
      new DOMMatrixPolyfill([1, 0, 0, 1, 10, 0]),
    );
    const p = m.transformPoint({ x: 0, y: 0 });
    expect([p.x, p.y]).toEqual([20, 0]);
  });

  it("invertSelf undoes scale + translate", () => {
    const m = new DOMMatrixPolyfill([2, 0, 0, 4, 10, 20]);
    const inv = m.inverse();
    const round = m.multiply(inv);
    expect(round.a).toBeCloseTo(1);
    expect(round.d).toBeCloseTo(1);
    expect(round.e).toBeCloseTo(0);
    expect(round.f).toBeCloseTo(0);
  });

  it("installs itself as a global when none exists", async () => {
    // Importing the module has the side effect of defining globalThis.DOMMatrix.
    expect(typeof globalThis.DOMMatrix).toBe("function");
    expect(typeof globalThis.ImageData).toBe("function");
    expect(typeof globalThis.Path2D).toBe("function");
  });
});
