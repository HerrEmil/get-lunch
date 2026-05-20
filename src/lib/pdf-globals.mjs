/**
 * Minimal browser-global polyfills for pdfjs-dist in Node/Lambda.
 *
 * pdfjs-dist polyfills DOMMatrix/ImageData/Path2D from the optional
 * "@napi-rs/canvas" package, a 25 MB native binary we deliberately don't ship
 * (it would blow the Lambda bundle size budget). We only do PDF *text*
 * extraction (getTextContent), which never rasterises — so a tiny pure-JS
 * DOMMatrix that supports the 2D ops pdfjs uses (multiply/translate/scale/
 * invert) is enough, and stubbed ImageData/Path2D keep the rendering paths
 * from throwing ReferenceErrors.
 *
 * Import this module before loading pdfjs; pdfjs only polyfills when the global
 * is absent (`if (!globalThis.DOMMatrix)`), so setting it first wins.
 */

/** A 2D affine matrix [a b c d e f], spec-compatible enough for pdfjs text. */
class DOMMatrixPolyfill {
  constructor(init) {
    // identity
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;

    if (Array.isArray(init)) {
      if (init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      } else if (init.length === 16) {
        // 4x4 column-major -> take the 2D components
        this.a = init[0];
        this.b = init[1];
        this.c = init[4];
        this.d = init[5];
        this.e = init[12];
        this.f = init[13];
      }
    } else if (init instanceof DOMMatrixPolyfill) {
      ({ a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f } =
        init);
    }
  }

  get is2D() {
    return true;
  }

  get isIdentity() {
    return (
      this.a === 1 &&
      this.b === 0 &&
      this.c === 0 &&
      this.d === 1 &&
      this.e === 0 &&
      this.f === 0
    );
  }

  // 3D aliases pdfjs occasionally reads
  get m11() {
    return this.a;
  }
  get m12() {
    return this.b;
  }
  get m21() {
    return this.c;
  }
  get m22() {
    return this.d;
  }
  get m41() {
    return this.e;
  }
  get m42() {
    return this.f;
  }

  /** this * other (other applied first), returns a new matrix */
  multiply(other) {
    return new DOMMatrixPolyfill().#setProduct(this, other);
  }

  multiplySelf(other) {
    return this.#setProduct(this, other, this);
  }

  preMultiplySelf(other) {
    return this.#setProduct(other, this, this);
  }

  translate(tx = 0, ty = 0) {
    return this.multiply(
      new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty]),
    );
  }

  translateSelf(tx = 0, ty = 0) {
    return this.multiplySelf(new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty]));
  }

  scale(sx = 1, sy = sx) {
    return this.multiply(new DOMMatrixPolyfill([sx, 0, 0, sy, 0, 0]));
  }

  scaleSelf(sx = 1, sy = sx) {
    return this.multiplySelf(new DOMMatrixPolyfill([sx, 0, 0, sy, 0, 0]));
  }

  invertSelf() {
    const det = this.a * this.d - this.b * this.c;
    if (!det) {
      this.a = this.b = this.c = this.d = this.e = this.f = NaN;
      return this;
    }
    const { a, b, c, d, e, f } = this;
    this.a = d / det;
    this.b = -b / det;
    this.c = -c / det;
    this.d = a / det;
    this.e = (c * f - d * e) / det;
    this.f = (b * e - a * f) / det;
    return this;
  }

  inverse() {
    return new DOMMatrixPolyfill(this).invertSelf();
  }

  transformPoint(point = { x: 0, y: 0 }) {
    const x = point.x ?? 0;
    const y = point.y ?? 0;
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f,
      z: 0,
      w: 1,
    };
  }

  toString() {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }

  /** out = m1 * m2 (m2 applied first); writes into `out` (defaults to a new matrix) */
  #setProduct(m1, m2, out = new DOMMatrixPolyfill()) {
    const a = m1.a * m2.a + m1.c * m2.b;
    const b = m1.b * m2.a + m1.d * m2.b;
    const c = m1.a * m2.c + m1.c * m2.d;
    const d = m1.b * m2.c + m1.d * m2.d;
    const e = m1.a * m2.e + m1.c * m2.f + m1.e;
    const f = m1.b * m2.e + m1.d * m2.f + m1.f;
    out.a = a;
    out.b = b;
    out.c = c;
    out.d = d;
    out.e = e;
    out.f = f;
    return out;
  }
}

/** Bare stubs — text extraction never reads these, but pdfjs references them. */
class ImageDataStub {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(0);
  }
}

class Path2DStub {
  addPath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
}

if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}
if (!globalThis.ImageData) {
  globalThis.ImageData = ImageDataStub;
}
if (!globalThis.Path2D) {
  globalThis.Path2D = Path2DStub;
}

export { DOMMatrixPolyfill };
