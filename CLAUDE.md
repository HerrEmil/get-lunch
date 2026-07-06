# Adding a new restaurant parser

Six files must be updated:

1. **`src/parsers/<name>-parser.mjs`** — Create parser extending `BaseParser`
2. **`src/parsers/<name>-parser.test.mjs`** — Tests for the parser
3. **`src/parsers/parser-factory.mjs`** — Import and register with `registerParserClass`
4. **`src/lambdas/data-collector.mjs`** — Add entry to `RESTAURANT_CONFIGS`
5. **`src/lambdas/api-server.mjs`** — Add entry to `RESTAURANT_CONFIGS` (separate list, easy to forget!)
6. **`.claude/settings.json`** — Add the restaurant's domain (bare + www) to `sandbox.network.allowedDomains` so sandboxed parser checks can fetch the site

Both `data-collector.mjs` and `api-server.mjs` have their own `RESTAURANT_CONFIGS` arrays. The collector writes to DynamoDB, the API server reads from it. Missing either one means data won't be collected or won't be displayed.

# Pushing directly to main

Run `yarn test:gate` before any direct push to `main` and abort the push if tests fail. CI no longer runs tests on push-to-main, so local tests are the only gate.

Use `yarn test:gate` (not plain `yarn test`): the RTK proxy hijacks bare `vitest`/`yarn test` and swallows the output ("[RTK:PASSTHROUGH] All parsing tiers failed"), so `yarn test` looks like it passed when it never ran. `test:gate` invokes vitest directly (`node node_modules/vitest/vitest.mjs run`), which RTK passes through untouched.
