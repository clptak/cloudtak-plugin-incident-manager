Vendored browser ESM build of [pdf-lib](https://pdf-lib.js.org/) (MIT).

## Why this is vendored

CloudTAK's Docker image builds the web UI with `npm run lint`, `npm run check`, and
`npm run build` over `./plugins/`. It only runs `npm install` in `api/web/`, so plugin
`package.json` dependencies are not installed and a bare `import 'pdf-lib'` fails
`vue-tsc`.

Vendoring keeps ICS 234 PDF export self-contained with no CloudTAK changes:

- `pdf-lib.esm.min.js` — self-contained pdf-lib ESM bundle. Prefixed with
  `/* eslint-disable */` because CloudTAK lints `./plugins/` with its own ESLint config.
- `pdf-lib.esm.min.d.ts` — minimal types for `src/lib/ics234Pdf.ts`.

## Updating

Copy from `node_modules/pdf-lib/dist/pdf-lib.esm.min.js` after `npm install pdf-lib`,
then prepend the eslint-disable header:

```bash
printf '/* eslint-disable */\n' > src/vendor/pdf-lib.esm.min.js
cat node_modules/pdf-lib/dist/pdf-lib.esm.min.js >> src/vendor/pdf-lib.esm.min.js
```

Verify no external imports (should print nothing):

```bash
grep -oE 'from["'"'"'][^./][^"'"'"']*["'"'"']' src/vendor/pdf-lib.esm.min.js
```
