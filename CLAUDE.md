# Adding a new restaurant parser

Four files must be updated:

1. **`src/parsers/<name>-parser.mjs`** — Create parser extending `BaseParser`
2. **`src/parsers/<name>-parser.test.mjs`** — Tests for the parser
3. **`src/parsers/parser-factory.mjs`** — Import and register with `registerParserClass`
4. **`src/lambdas/data-collector.mjs`** — Add entry to `RESTAURANT_CONFIGS`
5. **`src/lambdas/api-server.mjs`** — Add entry to `RESTAURANT_CONFIGS` (separate list, easy to forget!)

Both `data-collector.mjs` and `api-server.mjs` have their own `RESTAURANT_CONFIGS` arrays. The collector writes to DynamoDB, the API server reads from it. Missing either one means data won't be collected or won't be displayed.
