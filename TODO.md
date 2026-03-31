# TODO

- [x] ~~Verify Lambda packaging bundles jsdom~~ — Fixed: removed `node_modules/**` from exclude list
- [x] ~~Verify index.html is included in Lambda package~~ — Confirmed: include list has `index.html`, path resolves correctly
- [x] ~~Fix Niagara parser dish names~~ — Fixed: detects category headings (Green/Local/Asia/World Wide) and swaps with description
- [x] ~~Remove stale `iamRoleStatements:` key from serverless.yml~~ — Removed
- [x] ~~Set up custom domain~~ — Added `serverless-domain-manager` plugin for lunch.herremil.com

## Deployment steps (manual)

- [x] Request ACM certificate for `lunch.herremil.com` in `eu-north-1` (DNS validation via Route 53)
- [ ] Create custom domain: `npx serverless create_domain --stage prod`
- [ ] Deploy: `npx serverless deploy --stage prod`
- [ ] Trigger initial data collection: `aws lambda invoke --function-name enhanced-lunch-table-prod-dataCollector /tmp/out.json`
- [ ] Verify DynamoDB has data: `aws dynamodb scan --table-name enhanced-lunch-table-lunch-cache-prod --select COUNT`
