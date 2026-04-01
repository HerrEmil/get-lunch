# Get Lunch

Serverless lunch menu aggregator for restaurants in Malmö's Västra Hamnen. Scrapes restaurant websites daily, normalises the data, caches it in DynamoDB, and serves it via a single-page frontend on API Gateway/Lambda.

## Supported restaurants

Fonderie · Holy Greens · ICA Maxi · Kockum Fritid · Kontrast · Laziza · MiaMarias · Niagara · P2 · Spill · Taste · Ubåtshallen · Varv

## Setup

```bash
yarn install
```

## Running locally

```bash
yarn start            # Local API server
yarn dev:collection   # Run data collector locally
```

## Testing

```bash
yarn test             # Full suite
yarn test:parsers     # Parser tests only
yarn test:collector   # Data collector tests
yarn test:api         # API server tests
```

## Deployment

Serverless configurations live in `infrastructure/`.

```bash
yarn deploy           # Default stage
yarn deploy:dev       # Dev
yarn deploy:prod      # Prod
```

## Architecture

- **Data collector** — scheduled Lambda that scrapes all restaurant sites and writes to DynamoDB
- **API server** — Lambda behind API Gateway that reads cached data and serves an HTML page
- **Parsers** — one per restaurant, each extending a shared `BaseParser` class with circuit breaker protection
