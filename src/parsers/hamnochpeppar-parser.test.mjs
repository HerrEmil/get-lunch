import { beforeAll, describe, expect, it, beforeEach, vi } from "vitest";
import { HamnOchPepparParser } from "./hamnochpeppar-parser.mjs";

function createParser() {
  const parser = new HamnOchPepparParser();
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

// Captured verbatim from https://hamnochpeppar.gastrogate.com/lunch/
// (2026-07-17, ISO week 29). The Gastrogate platform renders the week as a
// single `table.lunch_menu` made of day blocks: a `thead.lunch-day-header` (an
// <h3> holding a weekday + date or a "Gäller hela vecka NN" whole-week block)
// followed by a `tbody.lunch-day-content` of `tr.lunch-menu-item` rows, each
// with the dish in `td.td_title` and the price in `td.td_price .price-tag`.
// Hamn o Peppar's current-week menu runs Mon–Thu with a main plus a pasta,
// closes Friday with a price-less "Vilodag" (rest day), and ends on a
// price-less "A la carte" whole-week pointer. Titles are indented onto their
// own line and Tuesday's carries a <br>, both of which collapse to a space.
// This fixture pins the ORIGINAL "Gäller hela vecka NN" whole-week wording;
// MOCK_HTML_VARDAGSMENY below pins the "Vardagsmeny" relabel. Keep both.
const MOCK_HTML = `
<html><body>
  <div class="btn-group menu-nav">
    <a class="btn btn-info dropdown-toggle" data-toggle="dropdown" href="#">Vecka 29<span class="caret"></span></a>
    <ul class="dropdown-menu">
      <li class="active"><a href="/lunch/">Vecka 29</a></li>
    </ul>
  </div>
  <div class="above_info">Dryck, bröd, sallad och kaffe ingår</div>
  <table class="table lunch_menu animation">
    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Måndag 13 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">
          Fläsksnitzel bearnaisesås purjolökspotatis          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">140 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">
          Pasta:Veckans pasta  Lasagne          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Tisdag 14 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">
          Dagens:Friterad spätta med dansk remouladsås och kokt <br />
nypotatis          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">140 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">
          Pasta:pasta carbonara          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Onsdag 15 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">
          Dagens:Stekt fläsk med löksås kokt potatis          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">
          Pasta:pasta carbonara          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Torsdag 16 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">
          Pasta:Majskyckling finskurna grönsaker och grönpepparsås          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
      <tr class="lunch-menu-item">
        <td class="td_title">
          Pasta:pasta carbonara          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"><div class="price-alt"><strong class="price-tag">130 kr</strong></div></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Fredag 17 juli</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">
          Vilodag          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"></div></div></td>
      </tr>
    </tbody>

    <thead class="lunch-day-header"><tr><th class="menu_header" colspan="3"><h3>Gäller hela vecka 29</h3></th></tr></thead>
    <tbody class="lunch-day-content">
      <tr class="lunch-menu-item">
        <td class="td_title">
          A la carte          </td>
        <td class="td_dbsk hidden-xs"><div class="incl-wrapper"></div></td>
        <td class="td_price"><div class="price-container"><div class="price"></div></div></td>
      </tr>
    </tbody>
  </table>
</body></html>
`;

// Captured verbatim from https://hamnochpeppar.gastrogate.com/lunch/
// (2026-08-10, ISO week 33 — the first week back after the summer closure).
// Same Gastrogate table shape as above, but the whole-week block is now
// labelled `<h3>Vardagsmeny</h3>` instead of "Gäller hela vecka NN", and it
// carries a PRICED dish ("Veckans kött…", 200 kr) that must fan out across
// Mon–Fri. Mon–Fri each carry one priced dish (Monday two), Friday's title
// holds a <br> and Thursday's a double space, both of which collapse to a
// single space. Monday's pasta row starts with a stray ">" in the source.
const MOCK_HTML_VARDAGSMENY = `
<html><body>
<div class="btn-group menu-nav">
	<a class="btn btn-info dropdown-toggle" data-toggle="dropdown" href="#">

		Vecka 33
		<span class="caret"></span>
	</a>
	<ul class="dropdown-menu">
		<li class="active">
			<a href="/lunch/">
				Vecka 33					</a>
		</li>
	</ul>
</div>
<div class="above_info">
	Lunchöppet mån-fre lunch 11:00-15:00	</div>
<div class="above_info">
	Dryck, bröd, sallad och kaffe ingår	</div>
<table class="table lunch_menu animation">

			<thead class="lunch-day-header">
			<tr>
				<th class="menu_header" colspan="3">
					<h3>Måndag 10 augusti</h3>
				</th>
			</tr>
		</thead>

		<tbody class="lunch-day-content">

												<tr class="lunch-menu-item">
						<td class="td_title">
							Stuvade makaroner med stekt falukorv													</td>
						<td class="td_dbsk hidden-xs">
							<div class="incl-wrapper">
															</div>
						</td>
						<td class="td_price">
							<div class="price-container">
								<div class="price">
																			<div class="price-alt">
											<strong class="price-tag">130 kr</strong>
										</div>
																	</div>
							</div>
						</td>
					</tr>
									<tr class="lunch-menu-item">
						<td class="td_title">
							>Pasta:Spaghetti bolognese													</td>
						<td class="td_dbsk hidden-xs">
							<div class="incl-wrapper">
															</div>
						</td>
						<td class="td_price">
							<div class="price-container">
								<div class="price">
																			<div class="price-alt">
											<strong class="price-tag">130 kr</strong>
										</div>
																	</div>
							</div>
						</td>
					</tr>
									</tbody>

			<thead class="lunch-day-header">
			<tr>
				<th class="menu_header" colspan="3">
					<h3>Tisdag 11 augusti</h3>
				</th>
			</tr>
		</thead>

		<tbody class="lunch-day-content">

												<tr class="lunch-menu-item">
						<td class="td_title">
							Dagens:Grillad laxfile med rostade rotfrukter och citronhollandaise													</td>
						<td class="td_dbsk hidden-xs">
							<div class="incl-wrapper">
															</div>
						</td>
						<td class="td_price">
							<div class="price-container">
								<div class="price">
																			<div class="price-alt">
											<strong class="price-tag">140 kr</strong>
										</div>
																	</div>
							</div>
						</td>
					</tr>
									</tbody>

			<thead class="lunch-day-header">
			<tr>
				<th class="menu_header" colspan="3">
					<h3>Onsdag 12 augusti</h3>
				</th>
			</tr>
		</thead>

		<tbody class="lunch-day-content">

												<tr class="lunch-menu-item">
						<td class="td_title">
							Dagens:Whiskyköttbullar lingon gräddsås och potatispure													</td>
						<td class="td_dbsk hidden-xs">
							<div class="incl-wrapper">
															</div>
						</td>
						<td class="td_price">
							<div class="price-container">
								<div class="price">
																			<div class="price-alt">
											<strong class="price-tag">140 kr</strong>
										</div>
																	</div>
							</div>
						</td>
					</tr>
									</tbody>

			<thead class="lunch-day-header">
			<tr>
				<th class="menu_header" colspan="3">
					<h3>Torsdag 13 augusti</h3>
				</th>
			</tr>
		</thead>

		<tbody class="lunch-day-content">

												<tr class="lunch-menu-item">
						<td class="td_title">
							Dagens  jambalaya New orleans style ägg, aioli													</td>
						<td class="td_dbsk hidden-xs">
							<div class="incl-wrapper">
															</div>
						</td>
						<td class="td_price">
							<div class="price-container">
								<div class="price">
																			<div class="price-alt">
											<strong class="price-tag">130 kr</strong>
										</div>
																	</div>
							</div>
						</td>
					</tr>
									</tbody>

			<thead class="lunch-day-header">
			<tr>
				<th class="menu_header" colspan="3">
					<h3>Fredag 14 augusti</h3>
				</th>
			</tr>
		</thead>

		<tbody class="lunch-day-content">

												<tr class="lunch-menu-item">
						<td class="td_title">
							Dagens:Wienerschnitzel gröna ärtor citron persiljesmör och <br />
rödvinsås													</td>
						<td class="td_dbsk hidden-xs">
							<div class="incl-wrapper">
															</div>
						</td>
						<td class="td_price">
							<div class="price-container">
								<div class="price">
																			<div class="price-alt">
											<strong class="price-tag">140 kr</strong>
										</div>
																	</div>
							</div>
						</td>
					</tr>
									</tbody>

			<thead class="lunch-day-header">
			<tr>
				<th class="menu_header" colspan="3">
					<h3>Vardagsmeny</h3>
				</th>
			</tr>
		</thead>

		<tbody class="lunch-day-content">

												<tr class="lunch-menu-item">
						<td class="td_title">
							Veckans kött:Lövbiff med bearnaisesås och pommes frites													</td>
						<td class="td_dbsk hidden-xs">
							<div class="incl-wrapper">
															</div>
						</td>
						<td class="td_price">
							<div class="price-container">
								<div class="price">
																			<div class="price-alt">
											<strong class="price-tag">200 kr</strong>
										</div>
																	</div>
							</div>
						</td>
					</tr>
									</tbody>

	</table>
</body></html>
`;

let JSDOM;

beforeAll(async () => {
  vi.doUnmock("jsdom");
  ({ JSDOM } = await import("jsdom"));
});

describe("HamnOchPepparParser", () => {
  let parser;

  beforeEach(() => {
    parser = createParser();
  });

  it("returns correct name and url", () => {
    expect(parser.getName()).toBe("Hamn o Peppar");
    expect(parser.getUrl()).toBe("https://hamnochpeppar.gastrogate.com/lunch/");
  });

  it("extracts the active week from the week selector", () => {
    const dom = new JSDOM(MOCK_HTML);
    expect(parser.extractWeekNumber(dom.window.document)).toBe(29);
  });

  it("maps day headers to weekdays and whole-week blocks", () => {
    expect(parser.headerToWeekdays("Måndag 13 juli")).toEqual(["måndag"]);
    expect(parser.headerToWeekdays("Fredag 17 juli")).toEqual(["fredag"]);
    expect(parser.headerToWeekdays("Gäller hela vecka 29")).toEqual([
      "måndag",
      "tisdag",
      "onsdag",
      "torsdag",
      "fredag",
    ]);
    // The same whole-week block was relabelled "Vardagsmeny" when the
    // restaurant reopened after the 2026 summer closure; both wordings must
    // fan out across the week.
    expect(parser.headerToWeekdays("Vardagsmeny")).toEqual([
      "måndag",
      "tisdag",
      "onsdag",
      "torsdag",
      "fredag",
    ]);
    expect(parser.headerToWeekdays("Lunch på Hamn o Peppar")).toEqual([]);
  });

  it("parses the Mon–Thu day blocks", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    // A main plus a pasta on each of Mon–Thu; Friday and the whole-week block
    // carry no priced dish.
    expect(lunches).toHaveLength(8);

    expect(new Set(lunches.map((l) => l.week))).toEqual(new Set([29]));
    expect(new Set(lunches.map((l) => l.place))).toEqual(
      new Set(["Hamn o Peppar"]),
    );

    for (const weekday of ["måndag", "tisdag", "onsdag", "torsdag"]) {
      expect(lunches.filter((l) => l.weekday === weekday)).toHaveLength(2);
    }

    // Monday's main keeps its price and is trimmed of the surrounding
    // indentation.
    expect(lunches[0].name).toBe("Fläsksnitzel bearnaisesås purjolökspotatis");
    expect(lunches[0].price).toBe(140);
    expect(lunches[0].weekday).toBe("måndag");

    // Monday's pasta collapses its double space.
    expect(lunches[1].name).toBe("Pasta:Veckans pasta Lasagne");

    // Tuesday's main collapses the <br> into a single space.
    expect(lunches[2].name).toBe(
      "Dagens:Friterad spätta med dansk remouladsås och kokt nypotatis",
    );
    expect(lunches[2].price).toBe(140);
  });

  it("skips the price-less Vilodag and A la carte rows", async () => {
    const dom = new JSDOM(MOCK_HTML);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    // Friday is a rest day: it must not invent a lunch, and the whole-week
    // "A la carte" pointer must not fan out across the week.
    expect(lunches.filter((l) => l.weekday === "fredag")).toHaveLength(0);
    expect(lunches.some((l) => /Vilodag|A la carte/.test(l.name))).toBe(false);
  });

  it("fans the priced Vardagsmeny block out across the week", async () => {
    const dom = new JSDOM(MOCK_HTML_VARDAGSMENY);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();

    // Six priced day rows (Monday has two) plus the whole-week "Vardagsmeny"
    // dish repeated on each of Mon–Fri.
    expect(lunches).toHaveLength(11);
    expect(new Set(lunches.map((l) => l.week))).toEqual(new Set([33]));

    const vardagsmeny = lunches.filter((l) => l.price === 200);
    expect(vardagsmeny).toHaveLength(5);
    expect(vardagsmeny.map((l) => l.weekday)).toEqual([
      "måndag",
      "tisdag",
      "onsdag",
      "torsdag",
      "fredag",
    ]);
    for (const lunch of vardagsmeny) {
      expect(lunch.name).toBe(
        "Veckans kött:Lövbiff med bearnaisesås och pommes frites",
      );
    }

    // The day rows still land on their own weekday only.
    expect(lunches.filter((l) => l.weekday === "måndag")).toHaveLength(3);
    expect(lunches.filter((l) => l.weekday === "tisdag")).toHaveLength(2);

    // Thursday's double space and Friday's <br> both collapse to one space.
    expect(lunches.find((l) => l.weekday === "torsdag").name).toBe(
      "Dagens jambalaya New orleans style ägg, aioli",
    );
    expect(lunches.find((l) => l.weekday === "fredag").name).toBe(
      "Dagens:Wienerschnitzel gröna ärtor citron persiljesmör och rödvinsås",
    );
  });

  it("returns no lunches when the menu table is missing", async () => {
    const dom = new JSDOM(`<html><body><p>Ingen meny</p></body></html>`);
    parser.fetchDocument = async () => dom.window.document;

    const lunches = await parser.parseMenu();
    expect(lunches).toEqual([]);
  });
});
