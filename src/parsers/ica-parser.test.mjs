import { describe, expect, it, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { IcaParser } from "./ica-parser.mjs";

function createParser() {
  const parser = new IcaParser();
  parser.logger = {
    info: () => Promise.resolve(),
    warn: () => Promise.resolve(),
    error: () => Promise.resolve(),
    debug: () => Promise.resolve(),
    startTimer: () => {},
    endTimer: () => {},
  };
  return parser;
}

function docFrom(html) {
  return new JSDOM(html).window.document;
}

describe("IcaParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("ICA Maxi");
    expect(parser.getUrl()).toContain("ica.se");
  });

  it("parses a menu where the dish follows the weekday header in a sibling element", () => {
    // ICA's lunch page is a WYSIWYG (Word-pasted) block: each weekday is a
    // <strong> header in its own <p>, followed by a <p> with the dish.
    const html = `<html><body><div>
      <p style="text-align:center"><strong><span style="font-size:22pt">Dagens lunch v.25</span></strong></p>
      <p style="text-align:center"><span>Pris 95 kr</span></p>
      <p><strong>Måndag</strong></p>
      <p>Köttbullar med potatismos och lingon</p>
      <p><strong>Tisdag</strong></p>
      <p>Stekt fläsk med löksås</p>
      <p><strong>Onsdag</strong></p>
      <p>Fiskgratäng med ris</p>
      <p><strong>Torsdag</strong></p>
      <p>Ärtsoppa och pannkakor</p>
      <p><strong>Fredag</strong></p>
      <p>Panerad torsk med remoulad</p>
    </div></body></html>`;

    const lunches = parser.extractMenu(docFrom(html));

    expect(lunches).toHaveLength(5);
    expect(lunches[0]).toMatchObject({
      name: "Köttbullar med potatismos och lingon",
      weekday: "måndag",
      week: 25,
      price: 95,
      place: "ICA Maxi",
    });
    expect(lunches[4]).toMatchObject({
      name: "Panerad torsk med remoulad",
      weekday: "fredag",
    });
  });

  it("parses a menu where the dish text follows the weekday in the same element", () => {
    const html = `<html><body><div>
      <p><strong>Måndag</strong> Köttbullar med potatismos</p>
      <p><strong>Tisdag</strong><br>Stekt fläsk med löksås</p>
    </div></body></html>`;

    const lunches = parser.extractMenu(docFrom(html));

    expect(lunches).toHaveLength(2);
    expect(lunches[0]).toMatchObject({
      name: "Köttbullar med potatismos",
      weekday: "måndag",
    });
    expect(lunches[1]).toMatchObject({
      name: "Stekt fläsk med löksås",
      weekday: "tisdag",
    });
  });

  it("returns no items when the page shows a vacation notice instead of a menu", () => {
    // Real-world state observed 2026-06: kitchen on summer break, no weekday
    // headers present. "Måndag/Tisdag" only appear in the page's opening-hours
    // data, which must not be mistaken for menu content.
    const html = `<html><body><div>
      <p><strong>Dagens lunch har gått på sommarlov.</strong></p>
      <p><strong>Vi är åter igen v.34 med hemlagade, goda luncher till er.</strong></p>
      <p>Idag: Måndag 07:00–22:00</p>
    </div></body></html>`;

    const lunches = parser.extractMenu(docFrom(html));
    expect(lunches).toHaveLength(0);
  });

  it("skips days explicitly marked as closed / no lunch", () => {
    const html = `<html><body><div>
      <p><strong>Måndag</strong></p>
      <p>Pasta carbonara</p>
      <p><strong>Tisdag</strong></p>
      <p>Ingen lunch idag</p>
    </div></body></html>`;

    const lunches = parser.extractMenu(docFrom(html));
    expect(lunches).toHaveLength(1);
    expect(lunches[0].weekday).toBe("måndag");
  });

  it("falls back to a default price when none is listed", () => {
    const html = `<html><body><div>
      <p><strong>Måndag</strong></p>
      <p>Pasta carbonara</p>
    </div></body></html>`;

    const lunches = parser.extractMenu(docFrom(html));
    expect(lunches).toHaveLength(1);
    expect(lunches[0].price).toBe(80);
  });

  it("extracts the week number from the page", () => {
    const doc = docFrom(
      `<html><body><p>Dagens lunch v.25</p></body></html>`,
    );
    expect(parser.extractWeekNumber(doc)).toBe(25);
  });
});
