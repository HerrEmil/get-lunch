import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { KockumParser } from "./kockum-parser.mjs";

function createParser() {
  const parser = new KockumParser();
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

// Legacy weekday-header format (pre 2026-07)
const SAMPLE_HTML = `
<html><body>
  <h1>136kr, ingår salladsbuffé, hembakat bröd & kaffe/te</h1>
  <p class="mobile-undersized-upper">Lunch vecka 14/2026</p>
  <p class="mobile-undersized-upper">Måndag</p>
  <p class="mobile-undersized-upper">Nötfärsbiff med kapris, rödbetor/ Dijon crème/ skysås</p>
  <p class="mobile-undersized-upper">Tisdag</p>
  <p class="mobile-undersized-upper">Fish & chips på sej/ citronmajonnäs/krasse</p>
  <p class="mobile-undersized-upper">Onsdag</p>
  <p class="mobile-undersized-upper">Schnitzel/tryffelmajonnäs/sprödsallad/skysås/riven parmesan</p>
  <p class="mobile-undersized-upper">Veckans vegetariska</p>
  <p class="mobile-undersized-upper">Marockansk gryta på quorn & kikärtor med yoghurt,</p>
  <p class="mobile-undersized-upper">rostad mandel & granatäpple</p>
  <p class="mobile-undersized-upper">Bön & fetaostbiffar/rostad paprikasås/spenat/rostad palsternacka</p>
  <p class="mobile-undersized-upper">GLAD PÅSK</p>
  <p>Smörrebröd</p>
</body></html>
`;

// Affärsluncher-only section, exactly as rendered on freda49.se (captured
// live 2026-07-02). Used both as the tier-3 fallback fixture and as the
// tail of the full-page fixture below.
const BUSINESS_LUNCH_SECTION = `
  <h2><span class="textheading2 mobile-undersized-upper" style="font-weight: bold; font-size: 14px;">Affärsluncher och Catering i Malmö</span><span style="font-weight: bold; color: rgba(19,19,19,1);">&nbsp;</span></h2>
  <p class="mobile-undersized-upper"><span style="font-weight: bold; color: rgba(27,27,27,1);">Vårens affärsluncher i Malmö</span></p>
  <p class="mobile-undersized-upper">&nbsp;</p>
  <p class="mobile-undersized-upper"><span style="color: rgba(19,19,19,1);">1. Fläskfilé med kålfrikassé &amp; dragonrostade potatisar</span></p>
  <p class="mobile-undersized-upper"><span style="color: rgba(19,19,19,1);"><br></span></p>
  <p class="mobile-undersized-upper"><span style="color: rgba(19,19,19,1);">2. Torsk med citronsmör, sparris &amp; dill</span></p>
  <p class="mobile-undersized-upper"><span style="color: rgba(19,19,19,1);">3. Färsbiff med pepparsås &amp; råstekt potatis</span></p>
  <p class="mobile-undersized-upper"><span style="color: rgba(19,19,19,1);">4. Salvia &amp; citronkyckling med ljummen potatissallad</span></p>
  <p class="mobile-undersized-upper"><span style="color: rgba(19,19,19,1);"><br></span></p>
  <p class="mobile-undersized-upper"><br></p>
  <p class="mobile-undersized-upper"><span style="font-weight: bold; color: rgba(19,19,19,1);">Affärslunchen kostar 195kr / person (inklusive moms)</span></p>
  <p class="mobile-undersized-upper"><span style="color: #131313; font-weight: normal;">Vi behöver beställning för affärslunch senast 2 dagar innan leverans med minst 10 portioner av varje vald rätt.</span></p>
  <p class="mobile-undersized-upper"><span style="color: rgba(19,19,19,1);">Lunch i Malmö för avhämtning Restaurang FreDa49</span></p>
`;

// Flat weekly-list format, exactly as rendered on freda49.se (captured live
// 2026-07-02): "Lunchmeny vecka 27" heading, bold dish names with non-bold
// description lines, &nbsp;/<br> spacer paragraphs, no weekday headers.
// Note the "Vitello Tonato" bold span nested inside a non-bold span.
const WEEKLY_LIST_HTML = `
<html><body>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #160202;"><span style="font-weight: bold;"><span class="textnormal" style="color: #101101; font-size: 20px; font-weight: bold;">Lunchmeny vecka 27</span></span></span></p>
  <p style="text-align: center; font-size: 14px;" class="mobile-undersized-upper"><span class="textnormal mobile-undersized-upper" style="font-size: 14px; color: #060000; font-weight: normal;">Serveras mellan 11.00-14.00, pris 136kr</span></p>
  <p style="text-align: center; font-size: 14px;" class="mobile-undersized-upper"><span class="textnormal mobile-undersized-upper" style="font-size: 14px; color: #060000; font-weight: normal;">Ingår måltidsdryck, kaffe/te och sidsallad</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span class="textnormal" style="font-size: 20px; font-weight: bold; color: #060000;"><br></span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101; font-weight: bold;">Citronmarinerad kycklingklubbstek</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101;">Serveras med potatissallad med kapris, örtcrème, rostad majskolv</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101;">&nbsp;</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101;">&nbsp;<span style="font-weight: bold;">Vitello Tonato</span></span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101;">Serveras med bärkapris, ruccola, potatissallad med kapris</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101; font-weight: bold;">Grekisk sallad med grillad kyckling</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101;">Innehåller: Tomat, gurka, olivolja, rödlök, fetaost, oregano, grön paprika</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101; font-weight: bold;">Asiatisk sallad med pankofriterad kyckling</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101;">Innehåller: krispig panko friterad kyckling, srirachamajonnäs, ingefära, sesamfrö, groddar, rotfruktschips, picklad rödlök &amp; wakame</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101; font-weight: bold;">Sommarsallad med betor, jordgubbar &amp; fetaost</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101;">Innehåller: betor, sparris, fänkål, honung, solroskärnor, rucola, romanssalad, lime, smörgåskrasse, fetaost, matvete</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101; font-weight: bold;">Veckans 3 smörrebröd</span></p>
  <p style="text-align: center;" class="mobile-undersized-upper"><span style="color: #120101;">Räkröra med ägg /hönsesallad medselleri / stekt sill med picklat</span></p>
  ${BUSINESS_LUNCH_SECTION}
</body></html>
`;

// Page variant where the weekly menu is absent and only the affärsluncher
// section remains (as observed earlier on 2026-07-02).
const BUSINESS_LUNCH_ONLY_HTML = `
<html><body>
  ${BUSINESS_LUNCH_SECTION}
</body></html>
`;

describe("KockumParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("has correct name and url", () => {
    expect(parser.getName()).toBe("Kockum Fritid");
    expect(parser.getUrl()).toContain("freda49.se");
  });

  describe("weekday-header format (legacy)", () => {
    it("extracts weekday dishes", () => {
      const doc = new JSDOM(SAMPLE_HTML).window.document;
      const lunches = parser.extractMenu(doc);

      const monday = lunches.filter((l) => l.weekday === "måndag" && !l.dietary?.includes("vegetarian"));
      expect(monday).toHaveLength(1);
      expect(monday[0].name).toContain("Nötfärsbiff");
      expect(monday[0].price).toBe(136);
      expect(monday[0].week).toBe(14);

      const tuesday = lunches.filter((l) => l.weekday === "tisdag" && !l.dietary?.includes("vegetarian"));
      expect(tuesday).toHaveLength(1);
      expect(tuesday[0].name).toContain("Fish & chips");
    });

    it("extracts vegetarian dishes for all weekdays", () => {
      const doc = new JSDOM(SAMPLE_HTML).window.document;
      const lunches = parser.extractMenu(doc);

      const vegMonday = lunches.filter(
        (l) => l.weekday === "måndag" && l.dietary?.includes("vegetarian"),
      );
      // Two veg dishes: Marockansk gryta + Bön & fetaostbiffar
      expect(vegMonday).toHaveLength(2);

      // First veg dish should have the continuation line merged
      expect(vegMonday[0].name).toContain("Marockansk gryta");
      expect(vegMonday[0].name).toContain("rostad mandel");
    });

    it("extracts week number", () => {
      const doc = new JSDOM(SAMPLE_HTML).window.document;
      const lunches = parser.extractMenu(doc);
      expect(lunches[0].week).toBe(14);
    });

    it("stops at smörrebröd section", () => {
      const doc = new JSDOM(SAMPLE_HTML).window.document;
      const lunches = parser.extractMenu(doc);
      const names = lunches.map((l) => l.name).join(" ");
      expect(names).not.toContain("Smörrebröd");
      expect(names).not.toContain("Rostbiff");
    });

    it("stops at affärslunch/catering section", () => {
      const html = `
        <html><body>
          <p class="mobile-undersized-upper">Lunch vecka 15/2026</p>
          <p class="mobile-undersized-upper">Onsdag</p>
          <p class="mobile-undersized-upper">Crispy chicken/papaya & morots sallad</p>
          <p class="mobile-undersized-upper">Veckans vegetariska</p>
          <p class="mobile-undersized-upper">Grillad haloumi/ratatouille/aioli/rostade fröer</p>
          <p class="mobile-undersized-upper">Vårens affärsluncher i Malmö</p>
          <p class="mobile-undersized-upper">1. Fläskfilé med kålfrikassé</p>
          <p class="mobile-undersized-upper">Affärslunchen kostar 195kr / person</p>
          <p class="mobile-undersized-upper">*Lunch Malmö är i Sverige den måltid...</p>
        </body></html>
      `;
      const doc = new JSDOM(html).window.document;
      const lunches = parser.extractMenu(doc);
      const names = lunches.map((l) => l.name).join(" | ");
      expect(names).not.toContain("affärslunch");
      expect(names).not.toContain("Affärslunchen");
      expect(names).not.toContain("Fläskfilé");
      expect(names).not.toContain("Wikipedia");
      expect(names).not.toContain("Lunch Malmö är");
      // Legitimate dishes still present
      expect(names).toContain("Crispy chicken");
      expect(names).toContain("Grillad haloumi");
    });
  });

  describe("flat weekly-list format (Lunchmeny vecka N, 2026-07)", () => {
    it("applies every dish to all five weekdays", () => {
      const doc = new JSDOM(WEEKLY_LIST_HTML).window.document;
      const lunches = parser.extractMenu(doc);

      // 6 dishes x 5 weekdays
      expect(lunches).toHaveLength(30);
      for (const day of ["måndag", "tisdag", "onsdag", "torsdag", "fredag"]) {
        expect(lunches.filter((l) => l.weekday === day)).toHaveLength(6);
      }
    });

    it("extracts dish names, descriptions, week and price", () => {
      const doc = new JSDOM(WEEKLY_LIST_HTML).window.document;
      const lunches = parser.extractMenu(doc);

      const monday = lunches.filter((l) => l.weekday === "måndag");
      expect(monday[0]).toMatchObject({
        name: "Citronmarinerad kycklingklubbstek",
        description:
          "Serveras med potatissallad med kapris, örtcrème, rostad majskolv",
        price: 136,
        week: 27,
        place: "Kockum Fritid",
      });
      expect(monday.map((l) => l.name)).toContain(
        "Grekisk sallad med grillad kyckling",
      );
      expect(monday.map((l) => l.name)).toContain("Veckans 3 smörrebröd");
    });

    it("handles a bold dish name nested inside a non-bold span", () => {
      const doc = new JSDOM(WEEKLY_LIST_HTML).window.document;
      const lunches = parser.extractMenu(doc);

      const vitello = lunches.find((l) => l.name.includes("Vitello"));
      expect(vitello).toBeDefined();
      expect(vitello.name).toBe("Vitello Tonato");
      expect(vitello.description).toBe(
        "Serveras med bärkapris, ruccola, potatissallad med kapris",
      );
    });

    it("does not leak header/info lines or the affärsluncher section", () => {
      const doc = new JSDOM(WEEKLY_LIST_HTML).window.document;
      const lunches = parser.extractMenu(doc);
      const names = lunches.map((l) => l.name).join(" | ");

      expect(names).not.toContain("Lunchmeny");
      expect(names).not.toContain("Serveras mellan");
      expect(names).not.toContain("Ingår måltidsdryck");
      expect(names).not.toContain("affärsluncher");
      expect(names).not.toContain("Fläskfilé");
      expect(names).not.toContain("kostar");
      // The affärsluncher price must not bleed into the weekly menu
      expect(lunches.every((l) => l.price === 136)).toBe(true);
    });
  });

  describe("affärsluncher fallback (no weekly menu published)", () => {
    it("applies the numbered dishes to all five weekdays", () => {
      const doc = new JSDOM(BUSINESS_LUNCH_ONLY_HTML).window.document;
      const lunches = parser.extractMenu(doc);

      // 4 numbered dishes x 5 weekdays
      expect(lunches).toHaveLength(20);
      for (const day of ["måndag", "tisdag", "onsdag", "torsdag", "fredag"]) {
        const dayLunches = lunches.filter((l) => l.weekday === day);
        expect(dayLunches).toHaveLength(4);
      }
    });

    it("strips the list number and extracts the 195kr price", () => {
      const doc = new JSDOM(BUSINESS_LUNCH_ONLY_HTML).window.document;
      const lunches = parser.extractMenu(doc);

      const names = [...new Set(lunches.map((l) => l.name))];
      expect(names).toEqual([
        "Fläskfilé med kålfrikassé & dragonrostade potatisar",
        "Torsk med citronsmör, sparris & dill",
        "Färsbiff med pepparsås & råstekt potatis",
        "Salvia & citronkyckling med ljummen potatissallad",
      ]);
      expect(lunches.every((l) => l.price === 195)).toBe(true);
      expect(lunches.every((l) => !/^\d+\./.test(l.name))).toBe(true);
    });

    it("does not include catering prose after the price line", () => {
      const doc = new JSDOM(BUSINESS_LUNCH_ONLY_HTML).window.document;
      const lunches = parser.extractMenu(doc);
      const names = lunches.map((l) => l.name).join(" | ");
      expect(names).not.toContain("beställning");
      expect(names).not.toContain("avhämtning");
      expect(names).not.toContain("kostar");
    });
  });

  it("extracts price from text", () => {
    expect(parser.extractPrice("136kr, ingår salladsbuffé")).toBe(136);
    expect(parser.extractPrice("145 kr")).toBe(145);
  });

  it("returns empty for page with no menu", () => {
    const doc = new JSDOM("<html><body><p>Stängt</p></body></html>").window.document;
    const lunches = parser.extractMenu(doc);
    expect(lunches).toHaveLength(0);
  });
});
