# Get Lunch

Serverless lunch menu aggregator for Restaurang Niagara and future restaurants. The project scrapes restaurant menus, normalises the data, and publishes it via API Gateway/Lambda.

## Prerequisites
- Node.js 18+
- npm or yarn
- AWS credentials with permission to deploy the Serverless stack (for deploy commands)

## Setup
```bash
npm install
# or
yarn install
```

## Running locally
- **Local API**: `npm run start` starts the local test server.
- **Manual collector run**: `npm run dev:collection` invokes the data collector handler locally.

## Testing
- Run the full suite: `npm test`
- Parser-specific tests: `npm run test:parsers`
- Lambda-specific tests: `npm run test:collector` or `npm run test:api`

## Deployment
Serverless configurations live in `infrastructure/`.
- Default deploy (stage from `serverless.yml`): `npm run deploy`
- Dev: `npm run deploy:dev`
- Prod: `npm run deploy:prod`
- Remove a stack: `npm run remove`

### Required environment
The deployed Lambdas expect:
- `LUNCH_CACHE_TABLE`: DynamoDB table for cached lunches (injected via `serverless*.yml`).
- `AWS_REGION`: AWS region (defaults to `eu-west-1`).
- Optional concurrency overrides: `MAX_CONCURRENCY`.

### Observability
- Tail API logs: `npm run logs`
- Tail collector logs: `npm run logs:collector`
- CloudWatch metrics/alarms are configured via Serverless; check the AWS console for alarm triggers and recent log streams.

### Rollback and support
1. If a deploy regresses, redeploy the last known good package with `serverless deploy --package <path>`.
2. To disable collectors quickly, set the restaurant `active` flag to `false` in `src/lambdas/data-collector.mjs` and redeploy.
3. The cache table should contain items keyed by `LUNCH_CACHE_TABLE`; verify the environment matches between Lambda and DynamoDB before invalidating data.
4. For sustained errors, inspect CloudWatch logs, confirm `LUNCH_CACHE_TABLE` exists, and re-run the collector locally with matching environment variables.
