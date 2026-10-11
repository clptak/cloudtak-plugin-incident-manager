import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    filterLpbRows,
    formatLpbCases,
    formatLpbMiles,
    lpbFolderName,
    lpbQuartileOptions,
    uniqueLpbFolderName,
} from './lpbTable.ts';
import type { AzlpbEntry } from './pluginSettings.ts';

const hiker: AzlpbEntry = {
    category: 'Hiker',
    cases: 12,
    qAmi: 0.46,
    qBmi: 3.43,
    qCmi: 12.24,
    qDmi: 26.78,
    maxMi: 36.48,
    meanMi: 8.09,
    qAme: 740.3,
    qBme: 5520.05,
    qCme: 19698.37,
    qDme: 43098.23,
    qAlabel: '25% - 0.46mi',
    qBlabel: '50% - 3.43mi',
    qClabel: '75% - 12.24mi',
    qDlabel: '90% - 26.78mi',
};

test('lpbQuartileOptions uses labels, meter radii, and 25/50 defaults', () => {
    const opts = lpbQuartileOptions(hiker);
    assert.equal(opts.length, 4);
    assert.deepEqual(opts.map((q) => q.id), ['A', 'B', 'C', 'D']);
    assert.equal(opts[0].label, '25% - 0.46mi');
    assert.equal(opts[1].label, '50% - 3.43mi');
    assert.equal(opts[2].label, '75% - 12.24mi');
    assert.equal(opts[3].label, '90% - 26.78mi');
    assert.equal(opts[0].meters, 740.3);
    assert.equal(opts[3].meters, 43098.23);
    assert.equal(opts[0].selected, true);
    assert.equal(opts[1].selected, true);
    assert.equal(opts[2].selected, false);
    assert.equal(opts[3].selected, false);
});

test('lpbQuartileOptions falls back to percentile labels when keys are missing', () => {
    const sparse: AzlpbEntry = {
        category: 'Sparse',
        cases: 1,
        qAmi: 1.5,
        qBmi: 2,
        qCmi: 3,
        qDmi: 4,
    };
    const opts = lpbQuartileOptions(sparse);
    assert.equal(opts[0].label, '25% - 1.5mi');
    assert.equal(opts[1].label, '50% - 2mi');
    assert.equal(opts[0].meters, 0);
});

test('lpbFolderName and uniqueLpbFolderName follow Search Area naming', () => {
    assert.equal(lpbFolderName('Hiker'), 'LPB Hiker - AZ');
    assert.equal(lpbFolderName('Hiker', 'Custom'), 'LPB Hiker - Custom');
    assert.equal(uniqueLpbFolderName('LPB Hiker - AZ', []), 'LPB Hiker - AZ');
    assert.equal(uniqueLpbFolderName('LPB Hiker - AZ', ['LPB Hiker - AZ']), 'LPB Hiker - AZ (2)');
    assert.equal(
        uniqueLpbFolderName('LPB Hiker - AZ', ['LPB Hiker - AZ', 'LPB Hiker - AZ (2)']),
        'LPB Hiker - AZ (3)',
    );
});

test('formatLpbMiles / formatLpbCases and category filter', () => {
    assert.equal(formatLpbMiles(0.46), '0.46');
    assert.equal(formatLpbMiles(undefined), '0.00');
    assert.equal(formatLpbCases(12), '12');
    assert.equal(formatLpbCases(12.7), '13');

    const rows = [hiker, { ...hiker, category: 'Aircraft-Crashed' }];
    assert.equal(filterLpbRows(rows, '').length, 2);
    assert.equal(filterLpbRows(rows, 'hike').length, 1);
    assert.equal(filterLpbRows(rows, 'AIRCRAFT')[0].category, 'Aircraft-Crashed');
    assert.equal(filterLpbRows(rows, 'nope').length, 0);
});
