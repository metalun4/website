### Todo:

~~1.Transform to Next.js~~  
~~2.Add project showcase.~~  
~~3.Add dashboard project.~~  

## Instagram checker tests

`npm test` runs the export parser and comparison tests. To exercise the checker in Chromium against a production build, run these commands from the repository root.

```sh
npx playwright install chromium --only-shell
npm run build
npm run test:instagram
```
