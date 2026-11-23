import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cadGeocodeQuery, formatMatchCoords, pickForwardMatch } from './cadGeocode.ts';

test('cadGeocodeQuery: the Address line, without LL(...) or a leading EST', () => {
    assert.equal(
        cadGeocodeQuery({ Address: 'LL(-110:45:16.9850,35:00:43.3943): EST 123 EXAMPLE LN TESTVILLE 86011' }),
        '123 EXAMPLE LN TESTVILLE 86011',
    );
    assert.equal(cadGeocodeQuery({ Address: '123  EXAMPLE LN\nTESTVILLE' }), '123 EXAMPLE LN');
});

test('cadGeocodeQuery: cross streets when there is no address, else empty', () => {
    assert.equal(cadGeocodeQuery({ 'Xstreet 1': 'MAIN ST', 'Xstreet 2': 'OAK AVE' }), 'MAIN ST & OAK AVE');
    assert.equal(cadGeocodeQuery({ Address: ' ', 'Xstreet 2': 'OAK AVE' }), 'OAK AVE');
    assert.equal(cadGeocodeQuery({}), '');
});

test('pickForwardMatch: first result with usable coordinates, labelled', () => {
    const m = pickForwardMatch([
        { address: 'nowhere' },
        { location: { x: 200, y: 10 } },
        { address: '123 Example Ln', location: { x: -110.75, y: 35.01 }, attributes: { LongLabel: '123 Example Ln, Testville, AZ' } },
    ], 'q');
    assert.deepEqual(m, { lat: 35.01, lng: -110.75, matched: '123 Example Ln, Testville, AZ' });
    assert.equal(pickForwardMatch([{ location: { x: 1, y: 2 } }], 'q')?.matched, 'q');
    assert.equal(pickForwardMatch([], 'q'), null);
    assert.equal(pickForwardMatch(undefined, 'q'), null);
});

test('formatMatchCoords: 5 places', () => {
    assert.equal(formatMatchCoords({ lat: 35.0120412, lng: -110.7547 }), '35.01204, -110.75470');
});
