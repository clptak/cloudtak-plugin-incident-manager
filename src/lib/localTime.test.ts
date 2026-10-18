import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMissionName } from './coords.ts';
import { localDateString, localDateTimeLabel } from './localTime.ts';

test('localDateString uses the local calendar date, not UTC', () => {
    // 23:30 local is already the next day in UTC for any zone west of UTC.
    assert.equal(localDateString(new Date(2026, 9, 18, 23, 30)), '2026-10-18');
});

test('localDateTimeLabel converts a Z timestamp to local wall-clock time', () => {
    const d = new Date('2026-10-19T00:30:00Z');
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    assert.equal(localDateTimeLabel('2026-10-19T00:30:00Z'), expected);
});

test('localDateTimeLabel leaves date-only, empty, and unparseable values unchanged', () => {
    assert.equal(localDateTimeLabel('2026-10-18'), '2026-10-18');
    assert.equal(localDateTimeLabel(''), '');
    assert.equal(localDateTimeLabel(undefined), '');
    assert.equal(localDateTimeLabel('not a date'), 'not a date');
});

test('localDateTimeLabel turns a datetime-local value into a space-separated label', () => {
    assert.equal(localDateTimeLabel('2026-10-18T17:05'), '2026-10-18 17:05');
});

test('buildMissionName falls back to the local date', () => {
    const name = buildMissionName({ incidentType: 'search' });
    assert.equal(name.startsWith(`${localDateString()}_search`), true);
});
