import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
    debriefKey,
    douglasPeucker,
    haversineMiles,
    parseGeoJsonTracks,
    parseGpxTracks,
    parseKmlTracks,
    parseTrackFile,
    referencedTrackUids,
    simplifyTrack,
    trackLengthMiles,
    trackLogCallsign,
    trackMetrics,
    trackMilesForOp,
    withoutTrack,
    withTrack,
} from './trackLog.ts';
import { findAll, parseXml, textOf } from './xml.ts';
import type { DebriefRecord, TrackLogRef } from './entities.ts';

// One minute of latitude is one nautical mile = 1.15078 statute miles.
const ONE_MINUTE_MI = 1.15078;

describe('xml', () => {
    it('reads attributes, nested text, CDATA and comments', () => {
        const doc = parseXml(`<?xml version="1.0"?>
            <!-- a comment -->
            <root xmlns:gx="http://x">
              <item id="1" name='quoted'>hello &amp; goodbye</item>
              <item id="2"><![CDATA[raw <not a tag>]]></item>
              <gx:coord>1 2 3</gx:coord>
              <empty/>
            </root>`);
        const items = findAll(doc, 'item');
        assert.equal(items.length, 2);
        assert.equal(items[0].attrs.id, '1');
        assert.equal(items[0].attrs.name, 'quoted');
        assert.equal(textOf(items[0]), 'hello & goodbye');
        assert.equal(textOf(items[1]), 'raw <not a tag>');
        // Namespace prefixes are stripped to the local name.
        assert.equal(textOf(findAll(doc, 'coord')[0]), '1 2 3');
        assert.equal(findAll(doc, 'empty').length, 1);
    });

    it('decodes numeric entities and survives an unclosed tag', () => {
        const doc = parseXml('<a><b>caf&#233;</b><c>open');
        assert.equal(textOf(findAll(doc, 'b')[0]), 'café');
        assert.equal(textOf(findAll(doc, 'c')[0]), 'open');
    });
});

describe('measurement', () => {
    it('measures a minute of latitude as one nautical mile', () => {
        const d = haversineMiles([0, 0], [0, 1 / 60]);
        assert.ok(Math.abs(d - ONE_MINUTE_MI) < 0.005, `got ${d}`);
    });

    it('sums leg lengths', () => {
        const miles = trackLengthMiles([[0, 0], [0, 1 / 60], [0, 2 / 60]]);
        assert.ok(Math.abs(miles - 2 * ONE_MINUTE_MI) < 0.01, `got ${miles}`);
    });

    it('reports point count, rounded miles and the time window', () => {
        const metrics = trackMetrics({
            name: 't',
            coords: [[0, 0], [0, 1 / 60]],
            times: ['2026-08-30T14:00:00.000Z', '2026-08-30T18:30:00.000Z'],
        });
        assert.equal(metrics.points, 2);
        assert.equal(metrics.lengthMi, 1.15);
        assert.equal(metrics.startedAt, '2026-08-30T14:00:00.000Z');
        assert.equal(metrics.endedAt, '2026-08-30T18:30:00.000Z');
    });
});

describe('simplification', () => {
    it('keeps endpoints and drops collinear interior points', () => {
        const line: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
        const out = douglasPeucker(line, 0.0001);
        assert.deepEqual(out, [[0, 0], [4, 0]]);
    });

    it('leaves short tracks untouched', () => {
        const line: [number, number][] = [[0, 0], [0, 1], [0, 2]];
        assert.equal(simplifyTrack(line, 1500), line);
    });

    it('thins a long track to the cap while preserving its shape', () => {
        const line: [number, number][] = [];
        for (let i = 0; i < 5000; i++) {
            line.push([-105 + i * 0.0001, 39 + Math.sin(i / 40) * 0.01]);
        }
        const out = simplifyTrack(line, 200);
        assert.ok(out.length <= 200, `got ${out.length}`);
        assert.ok(out.length > 20, `over-thinned to ${out.length}`);
        assert.deepEqual(out[0], line[0]);
        assert.deepEqual(out[out.length - 1], line[line.length - 1]);
        // Length is preserved to within a few percent.
        const ratio = trackLengthMiles(out) / trackLengthMiles(line);
        assert.ok(ratio > 0.9 && ratio < 1.1, `length ratio ${ratio}`);
    });
});

describe('GPX', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Team 3 Track</name>
    <trkseg>
      <trkpt lat="39.0000" lon="-105.0000"><ele>2700</ele><time>2026-08-30T14:00:00Z</time></trkpt>
      <trkpt lat="39.0100" lon="-105.0000"><ele>2705</ele><time>2026-08-30T14:20:00Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="39.0200" lon="-105.0000"><time>2026-08-30T14:40:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    it('concatenates segments of one track and keeps times', () => {
        const tracks = parseGpxTracks(gpx);
        assert.equal(tracks.length, 1);
        assert.equal(tracks[0].name, 'Team 3 Track');
        assert.equal(tracks[0].coords.length, 3);
        assert.deepEqual(tracks[0].coords[0], [-105, 39]);
        assert.equal(tracks[0].times?.length, 3);
        assert.equal(tracks[0].times?.[0], '2026-08-30T14:00:00.000Z');
    });

    it('falls back to routes when there is no track', () => {
        const tracks = parseGpxTracks(`<gpx><rte><name>Planned</name>
            <rtept lat="39" lon="-105"/><rtept lat="39.01" lon="-105"/></rte></gpx>`);
        assert.equal(tracks.length, 1);
        assert.equal(tracks[0].name, 'Planned');
        assert.equal(tracks[0].coords.length, 2);
        // No <time> children — the times array is dropped rather than half-filled.
        assert.equal(tracks[0].times, undefined);
    });

    it('skips points with unusable coordinates', () => {
        const tracks = parseGpxTracks(`<gpx><trk><trkseg>
            <trkpt lat="39" lon="-105"/><trkpt lat="bad" lon="-105"/>
            <trkpt lat="99" lon="-105"/><trkpt lat="39.01" lon="-105"/>
        </trkseg></trk></gpx>`);
        assert.equal(tracks[0].coords.length, 2);
    });
});

describe('KML', () => {
    it('reads a LineString placemark', () => {
        const tracks = parseKmlTracks(`<kml><Document><Placemark>
            <name>K9-1</name>
            <LineString><coordinates>
                -105.0,39.0,2700 -105.0,39.01,2705 -105.0,39.02,2710
            </coordinates></LineString>
        </Placemark></Document></kml>`);
        assert.equal(tracks.length, 1);
        assert.equal(tracks[0].name, 'K9-1');
        assert.equal(tracks[0].coords.length, 3);
        assert.deepEqual(tracks[0].coords[0], [-105, 39]);
    });

    it('reads a timestamped gx:Track', () => {
        const tracks = parseKmlTracks(`<kml><Placemark><name>Air 1</name>
            <gx:Track>
              <when>2026-08-30T14:00:00Z</when>
              <when>2026-08-30T14:10:00Z</when>
              <gx:coord>-105.0 39.0 2700</gx:coord>
              <gx:coord>-105.0 39.01 2705</gx:coord>
            </gx:Track>
        </Placemark></kml>`);
        assert.equal(tracks.length, 1);
        assert.equal(tracks[0].coords.length, 2);
        assert.equal(tracks[0].times?.[1], '2026-08-30T14:10:00.000Z');
    });

    it('numbers multiple lines inside one placemark', () => {
        const tracks = parseKmlTracks(`<kml><Placemark><name>Sweep</name><MultiGeometry>
            <LineString><coordinates>-105,39 -105,39.01</coordinates></LineString>
            <LineString><coordinates>-105.1,39 -105.1,39.01</coordinates></LineString>
        </MultiGeometry></Placemark></kml>`);
        assert.equal(tracks.length, 2);
        assert.equal(tracks[0].name, 'Sweep (1)');
        assert.equal(tracks[1].name, 'Sweep (2)');
    });
});

describe('GeoJSON', () => {
    it('reads a FeatureCollection with coordTimes', () => {
        const tracks = parseGeoJsonTracks(JSON.stringify({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: { name: 'Team 1', coordTimes: ['2026-08-30T14:00:00Z', '2026-08-30T15:00:00Z'] },
                geometry: { type: 'LineString', coordinates: [[-105, 39], [-105, 39.01]] },
            }, {
                type: 'Feature',
                properties: { name: 'A point' },
                geometry: { type: 'Point', coordinates: [-105, 39] },
            }],
        }));
        assert.equal(tracks.length, 1);
        assert.equal(tracks[0].name, 'Team 1');
        assert.equal(tracks[0].times?.length, 2);
    });

    it('splits a MultiLineString', () => {
        const tracks = parseGeoJsonTracks(JSON.stringify({
            type: 'Feature',
            properties: { callsign: 'Grid' },
            geometry: {
                type: 'MultiLineString',
                coordinates: [[[-105, 39], [-105, 39.01]], [[-105.1, 39], [-105.1, 39.01]]],
            },
        }));
        assert.equal(tracks.length, 2);
        assert.equal(tracks[0].name, 'Grid (1)');
    });

    it('rejects text that is not JSON', () => {
        assert.throws(() => parseGeoJsonTracks('not json'), /Not valid JSON/);
    });
});

describe('parseTrackFile dispatch', () => {
    it('picks the reader by extension', () => {
        assert.equal(parseTrackFile('<gpx><trk><trkseg><trkpt lat="39" lon="-105"/><trkpt lat="39.1" lon="-105"/></trkseg></trk></gpx>', 'a.gpx').length, 1);
        assert.equal(parseTrackFile('<kml><Placemark><LineString><coordinates>-105,39 -105,39.1</coordinates></LineString></Placemark></kml>', 'a.kml').length, 1);
    });

    it('sniffs content when the extension lies', () => {
        // KML content in a .json file — extension says GeoJSON, content wins.
        const kml = '<kml><Placemark><LineString><coordinates>-105,39 -105,39.1</coordinates></LineString></Placemark></kml>';
        assert.equal(parseTrackFile(kml, 'mislabelled.json').length, 1);
    });

    it('refuses something that is neither', () => {
        assert.throws(() => parseTrackFile('lat,lon\n39,-105', 'track.csv'), /Unrecognized/);
    });
});

describe('naming and record binding', () => {
    it('builds a map callsign from OP, segment and resource', () => {
        assert.equal(
            trackLogCallsign({ opNumber: 2, segmentLabel: '05', resource: 'Team 3' }),
            'TRK OP2 · 05 · Team 3',
        );
    });

    it('falls back to the file name and numbers multiples', () => {
        assert.equal(
            trackLogCallsign({ opNumber: 1, segmentLabel: '03', sourceName: 'garmin', index: 2, total: 3 }),
            'TRK OP1 · 03 · garmin (2)',
        );
    });

    it('keys a debrief by OP, segment, resource and timestamp', () => {
        const record: DebriefRecord = {
            opNumber: 2, segmentUid: 'uid-a', pod: 60, resource: 'Team 3',
            recordedAt: '2026-08-30T18:00:00.000Z',
        };
        assert.equal(debriefKey(record), '2|uid-a|Team 3|2026-08-30T18:00:00.000Z');
        // Same segment, different OP → different key.
        assert.notEqual(debriefKey(record), debriefKey({ ...record, opNumber: 3 }));
    });

    it('adds, replaces and removes tracks', () => {
        const track = (uid: string, lengthMi = 1): TrackLogRef => ({
            uid, name: uid, source: 'f.gpx', points: 10, lengthMi,
        });
        const base: DebriefRecord = { opNumber: 1, segmentUid: 'uid-a', pod: 50 };

        const one = withTrack(base, track('t1'));
        assert.equal(one.tracks?.length, 1);

        // Re-attaching the same uid replaces rather than duplicates.
        const replaced = withTrack(one, track('t1', 4));
        assert.equal(replaced.tracks?.length, 1);
        assert.equal(replaced.tracks?.[0].lengthMi, 4);

        const two = withTrack(replaced, track('t2'));
        assert.equal(two.tracks?.length, 2);

        const back = withoutTrack(withoutTrack(two, 't1'), 't2');
        assert.equal(back.tracks, undefined);
        // The original record is never mutated.
        assert.equal(base.tracks, undefined);
    });

    it('collects referenced uids and sums miles per OP', () => {
        const records: DebriefRecord[] = [
            {
                opNumber: 2, segmentUid: 'a', pod: 60,
                tracks: [{ uid: 't1', name: 'x', source: 'f', points: 5, lengthMi: 2.5 }],
            },
            {
                opNumber: 2, segmentUid: 'b', pod: 40,
                tracks: [{ uid: 't2', name: 'y', source: 'f', points: 5, lengthMi: 1.25 }],
            },
            { opNumber: 3, segmentUid: 'c', pod: 70 },
        ];
        assert.deepEqual([...referencedTrackUids(records)].sort(), ['t1', 't2']);
        assert.equal(trackMilesForOp(records, 2), 3.75);
        assert.equal(trackMilesForOp(records, 3), 0);
    });
});
