# TODO

- [ ] Trigger initial data collection — cache is empty, invoke Lambda manually or wait for next weekday 08:00 UTC
- [ ] Verify Lambda packaging bundles jsdom — `package.individually: true` may skip node_modules, and jsdom is not in Lambda runtime
- [ ] Verify index.html is included in Lambda package — api-server reads it via readFileSync
- [ ] Fix Niagara parser dish names — name field is the category ("Green", "Local") instead of the actual dish; description has the real food
- [ ] Remove stale `iamRoleStatements:` key from serverless.yml line 16
- [ ] Set up custom domain instead of raw API Gateway URL
