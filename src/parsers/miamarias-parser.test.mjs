import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { MiaMariasParser } from "./miamarias-parser.mjs";

function createParser() {
  const parser = new MiaMariasParser();
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

let JSDOM;

beforeAll(async () => {
  vi.doUnmock("jsdom");
  ({ JSDOM } = await import("jsdom"));
});

describe("MiaMariasParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("MiaMarias");
    expect(parser.getUrl()).toBe("https://miamarias.nu/lunch/");
  });

  it("extracts dishes grouped by category and day", () => {
    const dom = new JSDOM(`
      <div>
        <h2>Vecka 14</h2>
        <p>Intro text</p>
        <h2>Fisk</h2>
        <p>Kummel med saffranssås</p>
        <p>130:-</p>
        <h2>Kött</h2>
        <p>Färsbiffar med potatismos</p>
        <p>125:-</p>
        <h2>Vegetariskt</h2>
        <p>Ugnspannkaka med sallad</p>
        <p>120:-</p>
        <h2>Fisk</h2>
        <p>Stekt sill</p>
        <p>130:-</p>
        <h2>Kött</h2>
        <p>Burrito bowl med pulled pork</p>
        <p>125:-</p>
        <h2>Vegetariskt</h2>
        <p>Burrito bowl med oumphfärs</p>
        <p>120:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    expect(lunches.length).toBe(6);

    const monday = lunches.filter((l) => l.weekday === "måndag");
    expect(monday.length).toBe(3);
    expect(monday[0].name).toBe("Fisk");
    expect(monday[0].description).toContain("Kummel");
    expect(monday[0].price).toBe(130);
    expect(monday[1].name).toBe("Kött");
    expect(monday[1].price).toBe(125);
    expect(monday[2].name).toBe("Vegetariskt");
    expect(monday[2].price).toBe(120);

    const tuesday = lunches.filter((l) => l.weekday === "tisdag");
    expect(tuesday.length).toBe(3);
    expect(tuesday[0].description).toContain("sill");
  });

  it("extracts week number", () => {
    const dom = new JSDOM(`
      <div>
        <h2>Vecka 13</h2>
        <h2>Fisk</h2><p>Lax</p><p>130:-</p>
        <h2>Kött</h2><p>Biff</p><p>125:-</p>
        <h2>Vegetariskt</h2><p>Pasta</p><p>120:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);
    expect(lunches[0].week).toBe(13);
  });

  it("joins multi-paragraph dish descriptions before the price", () => {
    const dom = new JSDOM(`
      <div>
        <h2>Vecka 15</h2>
        <h2>Fisk</h2>
        <p>Röd currygryta med limemarinerad torsk</p>
        <p>130:-</p>
        <h2>Kött</h2>
        <p>Lasagne på nötfärs med</p>
        <p>tomat och mozzarellasallad</p>
        <p>125:-</p>
        <h2>Vegetariskt</h2>
        <p>Krämig sötpotatisdahl</p>
        <p>120:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);
    const kott = lunches.find((l) => l.name === "Kött");
    expect(kott.description).toBe(
      "Lasagne på nötfärs med tomat och mozzarellasallad",
    );
    expect(kott.price).toBe(125);
  });

  it("skips closed day headings", () => {
    const dom = new JSDOM(`
      <div>
        <h2>Vecka 14</h2>
        <h2>Fisk</h2><p>Lax</p><p>130:-</p>
        <h2>Kött</h2><p>Biff</p><p>125:-</p>
        <h2>Vegetariskt</h2><p>Pasta</p><p>120:-</p>
        <h2>Påskstängt!</h2>
        <h2>Fisk</h2><p>Torsk</p><p>130:-</p>
        <h2>Kött</h2><p>Fläsk</p><p>125:-</p>
        <h2>Vegetariskt</h2><p>Halloumi</p><p>120:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    const monday = lunches.filter((l) => l.weekday === "måndag");
    const wednesday = lunches.filter((l) => l.weekday === "onsdag");
    expect(monday.length).toBe(3);
    expect(wednesday.length).toBe(3);
  });

  it("never produces conflicting (duplicate) weekday entries", () => {
    // Each weekday + category combination must appear at most once. This
    // guards against the bug where overflow weekday slots were folded onto
    // Monday, putting two different dishes under "måndag/Fisk".
    const week = parser._getCurrentWeek();
    const dom = new JSDOM(`
      <div>
        <h2>Vecka ${week}</h2>
        <h2>Fisk</h2><p>Mån fisk</p><p>130:-</p>
        <h2>Kött</h2><p>Mån kött</p><p>130:-</p>
        <h2>Vegetariskt</h2><p>Mån veg</p><p>130:-</p>
        <h2>Fisk</h2><p>Tis fisk</p><p>130:-</p>
        <h2>Kött</h2><p>Tis kött</p><p>130:-</p>
        <h2>Vegetariskt</h2><p>Tis veg</p><p>130:-</p>
        <h2>Fisk</h2><p>Ons fisk</p><p>130:-</p>
        <h2>Kött</h2><p>Ons kött</p><p>130:-</p>
        <h2>Vegetariskt</h2><p>Ons veg</p><p>130:-</p>
        <h2>Fisk</h2><p>Tor fisk</p><p>130:-</p>
        <h2>Kött</h2><p>Tor kött</p><p>130:-</p>
        <h2>Vegetariskt</h2><p>Tor veg</p><p>130:-</p>
        <h2>Stängt</h2>
        <h2>Fisk</h2><p>Overflow fisk</p><p>130:-</p>
        <h2>Kött</h2><p>Overflow kött</p><p>130:-</p>
        <h2>Vegetariskt</h2><p>Overflow veg</p><p>130:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    // Friday is "Stängt" and the trailing triplet overflows past Friday, so
    // only the four open weekdays remain: 4 days × 3 categories.
    expect(lunches.length).toBe(12);

    const seen = new Set();
    for (const l of lunches) {
      const key = `${l.weekday}/${l.name}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }

    // The overflow dishes must not have been folded onto an existing weekday.
    expect(lunches.some((l) => l.description.includes("Overflow"))).toBe(false);
    const mondayFisk = lunches.filter(
      (l) => l.weekday === "måndag" && l.name === "Fisk",
    );
    expect(mondayFisk.length).toBe(1);
    expect(mondayFisk[0].description).toBe("Mån fisk");
  });

  it("selects only the current week when two weeks are present", () => {
    const week = parser._getCurrentWeek();
    const dom = new JSDOM(`
      <div>
        <h2>Vecka ${week}</h2>
        <h2>Fisk</h2><p>Denna veckas fisk</p><p>130:-</p>
        <h2>Kött</h2><p>Denna veckas kött</p><p>130:-</p>
        <h2>Vegetariskt</h2><p>Denna veckas veg</p><p>130:-</p>
        <h2>Vecka ${week + 1}</h2>
        <h2>Fisk</h2><p>Nästa veckas fisk</p><p>140:-</p>
        <h2>Kött</h2><p>Nästa veckas kött</p><p>140:-</p>
        <h2>Vegetariskt</h2><p>Nästa veckas veg</p><p>140:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    expect(lunches.length).toBe(3);
    expect(lunches.every((l) => l.week === week)).toBe(true);
    expect(lunches.some((l) => l.description.includes("Nästa"))).toBe(false);
    expect(lunches[0].price).toBe(130);
  });

  describe("day-tab layout (live site markup)", () => {
    // Mirrors the Elementor tab widget on miamarias.nu/lunch/: tab titles
    // carry the weekday (Friday decorated as "Schnitzelfredag"), panels hold
    // the categories, and Friday's panel opens with a "Stängt" notice h2.
    const TABBED_MOCK = `
      <div>
        <h2>Vecka 29</h2>
        <p>Intro text</p>
        <div class="e-n-tabs">
          <div class="e-n-tabs-heading">
            <button><span class="e-n-tab-title-text">Måndag</span></button>
            <button><span class="e-n-tab-title-text">Tisdag</span></button>
            <button><span class="e-n-tab-title-text">Onsdag</span></button>
            <button><span class="e-n-tab-title-text">Torsdag</span></button>
            <button><span class="e-n-tab-title-text">Schnitzelfredag</span></button>
          </div>
          <div class="e-n-tabs-content">
            <div>
              <h2>Fisk</h2><p>Mån fisk</p><p>130:-</p>
              <h2>Kött</h2><p>Mån kött</p><p>130:-</p>
              <h2>Vegetariskt</h2><p>Mån veg</p><p>130:-</p>
            </div>
            <div>
              <h2>Fisk</h2><p>Tis fisk</p><p>130:-</p>
              <h2>Kött</h2><p>Tis kött</p><p>130:-</p>
              <h2>Vegetariskt</h2><p>Tis veg</p><p>130:-</p>
            </div>
            <div>
              <h2>Fisk</h2><p>Ons fisk</p><p>130:-</p>
              <h2>Kött</h2><p>Ons kött</p><p>130:-</p>
              <h2>Vegetariskt</h2><p>Ons veg</p><p>130:-</p>
            </div>
            <div>
              <h2>Fisk</h2><p>Tor fisk</p><p>130:-</p>
              <h2>Kött</h2><p>Tor kött</p><p>130:-</p>
              <h2>Vegetariskt</h2><p>Tor veg</p><p>130:-</p>
              <h2>Torsdagens soppa</h2><p>Ärtsoppa</p><p>110:-</p>
            </div>
            <div>
              <h2>Stängt</h2>
              <p>Semesterstängt v. 28–32</p>
              <h2>Fisk</h2><p>Kolja med rostad potatis</p><p>130:-</p>
              <h2>Kött</h2><p>Fläskschnitzel med skysås</p><p>130:-</p>
              <h2>Vegetariskt</h2><p>Lasagne med sötpotatis</p><p>130:-</p>
            </div>
          </div>
        </div>
      </div>
    `;

    it("maps decorated day titles to weekdays (Schnitzelfredag -> fredag)", () => {
      const dom = new JSDOM(TABBED_MOCK);
      const lunches = parser.extractMenu(dom.window.document);

      expect(lunches.length).toBe(15);
      expect(lunches.every((l) => l.week === 29)).toBe(true);

      const friday = lunches.filter((l) => l.weekday === "fredag");
      expect(friday.length).toBe(3);
      expect(friday.map((l) => l.name)).toEqual([
        "Fisk",
        "Kött",
        "Vegetariskt",
      ]);
      expect(friday[1].description).toContain("Fläskschnitzel");
    });

    it("does not let a Stängt notice inside a panel shift or leak dishes", () => {
      const dom = new JSDOM(TABBED_MOCK);
      const lunches = parser.extractMenu(dom.window.document);

      // Every weekday present exactly once per category.
      for (const day of ["måndag", "tisdag", "onsdag", "torsdag", "fredag"]) {
        expect(lunches.filter((l) => l.weekday === day).length).toBe(3);
      }
      // The notice paragraph and the soup (non-category heading) are not
      // captured as dishes.
      expect(
        lunches.some((l) => l.description.includes("Semesterstängt")),
      ).toBe(false);
      expect(lunches.some((l) => l.description.includes("Ärtsoppa"))).toBe(
        false,
      );
    });

    it("skips tabs whose title contains no weekday name", () => {
      const dom = new JSDOM(`
        <div>
          <h2>Vecka 29</h2>
          <div class="e-n-tabs">
            <div class="e-n-tabs-heading">
              <button><span class="e-n-tab-title-text">Måndag</span></button>
              <button><span class="e-n-tab-title-text">Helgbuffé</span></button>
            </div>
            <div class="e-n-tabs-content">
              <div>
                <h2>Fisk</h2><p>Mån fisk</p><p>130:-</p>
              </div>
              <div>
                <h2>Kött</h2><p>Helg kött</p><p>200:-</p>
              </div>
            </div>
          </div>
        </div>
      `);

      const lunches = parser.extractMenu(dom.window.document);

      expect(lunches.length).toBe(1);
      expect(lunches[0].weekday).toBe("måndag");
      expect(lunches.some((l) => l.description.includes("Helg"))).toBe(false);
    });
  });

  it("falls back to the first section when the current week is absent", () => {
    // Mirrors the live-site situation where the page still shows last week's
    // menu. The parser should surface that single section rather than nothing.
    const stale = parser._getCurrentWeek() - 1;
    const dom = new JSDOM(`
      <div>
        <h2>Vecka ${stale}</h2>
        <h2>Fisk</h2><p>Gammal fisk</p><p>130:-</p>
        <h2>Kött</h2><p>Gammalt kött</p><p>130:-</p>
        <h2>Vegetariskt</h2><p>Gammal veg</p><p>130:-</p>
      </div>
    `);

    const lunches = parser.extractMenu(dom.window.document);

    expect(lunches.length).toBe(3);
    expect(lunches[0].week).toBe(stale);
  });
});
