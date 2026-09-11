import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    parseLpbTable,
    parseLpbTableJson,
    parseStoredPluginSettings,
} from './pluginSettings.ts';
import {
    DEFAULT_SUBJECT_TYPES,
    MAX_SUBJECT_TYPES,
    mergeSubjectTypes,
    normalizeSubjectTypes,
    parseSubjectTypesText,
    parseAidingAgenciesText,
    subjectTypeEnumOptions,
    SUBJECT_TYPE_PLACEHOLDER,
} from './subjectTypes.ts';

test('normalizeSubjectTypes trims, drops blanks, and de-dupes case-insensitively', () => {
    assert.deepEqual(
        normalizeSubjectTypes([' Hiker ', '', 'hiker', 'Hunter', 'HUNTER']),
        ['Hiker', 'Hunter'],
    );
});

test('normalizeSubjectTypes caps at MAX_SUBJECT_TYPES', () => {
    const labels = Array.from({ length: MAX_SUBJECT_TYPES + 10 }, (_, i) => `Type ${i}`);
    assert.equal(normalizeSubjectTypes(labels).length, MAX_SUBJECT_TYPES);
});

test('parseSubjectTypesText reads a JSON string array', () => {
    const parsed = parseSubjectTypesText('["Hiker", "Hunter", "Hiker"]');
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.value, ['Hiker', 'Hunter']);
});

test('parseSubjectTypesText reads { subjectTypes }', () => {
    const parsed = parseSubjectTypesText('{ "subjectTypes": ["Child", "Elderly"] }');
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.value, ['Child', 'Elderly']);
});

test('parseSubjectTypesText reads CSV / newline lists', () => {
    const parsed = parseSubjectTypesText('Hiker, Hunter\nChild');
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.value, ['Hiker', 'Hunter', 'Child']);
});

test('parseSubjectTypesText rejects empty and invalid JSON', () => {
    assert.equal(parseSubjectTypesText('').ok, false);
    assert.equal(parseSubjectTypesText('   ').ok, false);
    const bad = parseSubjectTypesText('{ not json');
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.error, /not valid JSON/);
    const missing = parseSubjectTypesText('{ "foo": [] }');
    assert.equal(missing.ok, false);
});

test('mergeSubjectTypes appends new labels and keeps first spelling', () => {
    assert.deepEqual(
        mergeSubjectTypes(['Hiker', 'Hunter'], ['hunter', 'Climber']),
        ['Hiker', 'Hunter', 'Climber'],
    );
});

test('subjectTypeEnumOptions keeps a deleted current value', () => {
    assert.deepEqual(
        subjectTypeEnumOptions(['Hiker'], 'Custom Type'),
        [SUBJECT_TYPE_PLACEHOLDER, 'Hiker', 'Custom Type'],
    );
});

test('parseAidingAgenciesText reads JSON array, { agencies }, and CSV', () => {
    const arr = parseAidingAgenciesText('["Sheriff", "Forest Service"]');
    assert.equal(arr.ok, true);
    if (arr.ok) assert.deepEqual(arr.value, ['Sheriff', 'Forest Service']);

    const obj = parseAidingAgenciesText('{ "agencies": ["BLM", "Fire"] }');
    assert.equal(obj.ok, true);
    if (obj.ok) assert.deepEqual(obj.value, ['BLM', 'Fire']);

    const alt = parseAidingAgenciesText('{ "aidingAgencies": ["NPS"] }');
    assert.equal(alt.ok, true);
    if (alt.ok) assert.deepEqual(alt.value, ['NPS']);

    const csv = parseAidingAgenciesText('Sheriff, BLM\nNPS');
    assert.equal(csv.ok, true);
    if (csv.ok) assert.deepEqual(csv.value, ['Sheriff', 'BLM', 'NPS']);
});

const validLpbRow = {
    category: 'Hiker',
    cases: 12,
    qAmi: 0.5,
    qBmi: 1.2,
    qCmi: 2.4,
    qDmi: 5.0,
    maxMi: 9.1,
};

test('parseLpbTableJson accepts bundled-shaped rows and keeps extra fields', () => {
    const parsed = parseLpbTableJson(JSON.stringify([validLpbRow]));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
        assert.equal(parsed.value.length, 1);
        assert.equal(parsed.value[0].category, 'Hiker');
        assert.equal(parsed.value[0].qAmi, 0.5);
        assert.equal(parsed.value[0].maxMi, 9.1);
    }
});

test('parseLpbTableJson rejects missing category or qAmi', () => {
    const noCategory = parseLpbTableJson(JSON.stringify([{ ...validLpbRow, category: '' }]));
    assert.equal(noCategory.ok, false);
    if (!noCategory.ok) assert.match(noCategory.error, /category/);

    const withoutAmi = {
        category: validLpbRow.category,
        cases: validLpbRow.cases,
        qBmi: validLpbRow.qBmi,
        qCmi: validLpbRow.qCmi,
        qDmi: validLpbRow.qDmi,
        maxMi: validLpbRow.maxMi,
    };
    const noAmi = parseLpbTableJson(JSON.stringify([withoutAmi]));
    assert.equal(noAmi.ok, false);
    if (!noAmi.ok) assert.match(noAmi.error, /qAmi/);
});

test('parseLpbTable rejects non-arrays and empty arrays', () => {
    const obj = parseLpbTable({ category: 'Hiker' });
    assert.equal(obj.ok, false);
    const empty = parseLpbTable([]);
    assert.equal(empty.ok, false);
});

test('parseLpbTableJson rejects invalid JSON', () => {
    const bad = parseLpbTableJson('not json');
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.error, /not valid JSON/);
});

test('parseStoredPluginSettings uses defaults and validates lpbTable', () => {
    const missing = parseStoredPluginSettings(null);
    assert.deepEqual(missing.subjectTypes, DEFAULT_SUBJECT_TYPES);
    assert.equal(missing.lpbTable, null);

    const custom = parseStoredPluginSettings({
        subjectTypes: ['Climber', 'Hiker'],
        lpbTable: [validLpbRow],
    });
    assert.deepEqual(custom.subjectTypes, ['Climber', 'Hiker']);
    assert.equal(custom.lpbTable?.[0].category, 'Hiker');

    const badLpb = parseStoredPluginSettings({
        subjectTypes: ['Hiker'],
        lpbTable: [{ category: 'Nope' }],
    });
    assert.equal(badLpb.lpbTable, null);
});

test('parseStoredPluginSettings reads agency settings', () => {
    const parsed = parseStoredPluginSettings({
        yourAgency: '  County SAR  ',
        useD4hAidingAgencies: false,
        aidingAgencies: [' Forest Service ', 'Sheriff', 'sheriff'],
    });
    assert.equal(parsed.yourAgency, 'County SAR');
    assert.equal(parsed.useD4hAidingAgencies, false);
    assert.deepEqual(parsed.aidingAgencies, ['Forest Service', 'Sheriff']);
});

test('parseStoredPluginSettings defaults D4H aiding agencies on', () => {
    const missing = parseStoredPluginSettings({});
    assert.equal(missing.yourAgency, '');
    assert.equal(missing.useD4hAidingAgencies, true);
    assert.deepEqual(missing.aidingAgencies, []);
    assert.equal(missing.searchOpTemplateId, '');
    assert.equal(missing.useD4hPersonnel, true);
    assert.deepEqual(missing.personnel, []);
});

test('parseStoredPluginSettings reads personnel settings', () => {
    const parsed = parseStoredPluginSettings({
        useD4hPersonnel: false,
        personnel: [
            { id: 1, name: 'Smith, Jane', ref: '42', phone: '555' },
            { id: 'x', name: 'Bad' },
            { id: 1, name: 'Duplicate' },
        ],
    });
    assert.equal(parsed.useD4hPersonnel, false);
    assert.deepEqual(parsed.personnel, [{ id: 1, name: 'Smith, Jane', ref: '42' }]);
});

test('parseStoredPluginSettings reads searchOpTemplateId', () => {
    const parsed = parseStoredPluginSettings({
        searchOpTemplateId: '  tmpl-sar-1  ',
    });
    assert.equal(parsed.searchOpTemplateId, 'tmpl-sar-1');
});
