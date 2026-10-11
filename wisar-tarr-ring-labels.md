# WiSAR TARR ring labels: applied vs table distance

Decided 2026-10-01 (Paul): TARR rings posted to DataSync are named

    {percent}% - {miles}mi - {Category}        e.g. "25% - 0.80mi - Search-Hiker"

in a folder named `AZ LPB {Category} WiSAR` (Koester profiles: `Koester LPB {Category} WiSAR`).

## Current behaviour (option A): applied distance

`{miles}` is the distance the ring is actually drawn at, after calibration:

| Source | Calibration | Label miles |
|---|---|---|
| Arizona (IM table), checkbox off (default) | none | same as the table (e.g. 0.76) |
| Arizona, "Apply Coconino global calibration" on | ×1.05 / ×1.35 / ×1.80 | calibrated (e.g. 0.76 × 1.05 = 0.80) |
| Koester (WiSAR), unedited | category or global Coconino multipliers | calibrated |
| Edited values | none, or global when the checkbox is on | as entered, or calibrated |

The miles come from each contour's `threshold_m` (WiSAR's cost-distance threshold, i.e. the final
distance in metres), converted with 1609.344 m/mi and rounded to 2 decimals. The TARR form tells the
user this: under the calibration checkbox when it is on, and under the Koester calibration line.

Code: `tarrCallsign()` and `ringNaming()` in `src/lib/wisarResults.ts`; tests in
`src/lib/wisarResults.test.ts` ("TARR naming follows decision 5 for each source").

## Switching to option B: table/profile distance

Use this if feedback says labels should match the LPB table / Koester profile rather than the drawn ring.
The rings themselves do not change; only their names.

1. **`src/lib/wisarResults.ts`, `ringNaming()`** — for TARR, take the distance from the job's
   `resolved.source_distances_km` (the values before calibration, always in km) instead of
   `f.properties.threshold_m`:

   ```ts
   if (job.type === 'tarr') {
       const pct = f.properties.percentile ?? '';               // '25%' | '50%' | '75%'
       const band = ({ '25%': 'p25', '50%': 'p50', '75%': 'p75' } as const)[pct as '25%' | '50%' | '75%'];
       const src = (job.resolved as ResolvedTarr | undefined)?.source_distances_km;
       const metres = src && band ? src[band] * 1000 : f.properties.threshold_m;  // fall back to applied
       return {
           folder: tarrFolderName(job),
           callsign: tarrCallsign(pct, metres, tarrNaming(job).category),
           areaPrefix: TARR_AREA_PREFIX,
           areaId: pct.replace('%', ''),
       };
   }
   ```

   `ringNaming()` already receives the whole job (add `'resolved'` to its `Pick<Job, …>` type and
   import `ResolvedTarr` from `./wisar.ts`). For Arizona, `source_distances_km` is the table's miles
   converted to km by WiSAR, so the label comes back to the table value (0.76 mi → 1.2231 km →
   "0.76mi").

2. **`src/lib/wisarResults.test.ts`** — in "TARR naming follows decision 5 for each source", give the
   test job a `resolved.source_distances_km` and expect the label from it (and the applied-distance
   fallback when `resolved` is missing).

3. **`src/components/wisar/WisarTarrForm.vue`** — change the two notes:
   - under the calibration checkbox: "Calibration moves the rings out (×…). Their DataSync labels keep
     the table values above, so a ring is drawn farther out than its label says."
   - under the Koester calibration line: "Ring labels show the profile distances; rings are drawn at
     the calibrated distances."

4. **This file** — record the change and the date.

Run `npm test`, then CloudTAK's lint and type check, before committing (CloudTAK's Docker build runs
both over `./plugins/`).

## Not affected

- Travel Time rings (`{n}h Travel Time` in `WiSAR Distance Traveled`).
- The map preview, downloads and the GeoJSON/KML from WiSAR (those carry WiSAR's own
  "25% Percentile TARR" names and threshold remarks).
