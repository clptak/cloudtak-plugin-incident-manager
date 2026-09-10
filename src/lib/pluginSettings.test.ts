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

test('DEFAULT_SUBJECT_TYPES includes Other and Hiker', () => {
    assert.ok(DEFAULT_SUBJECT_TYPES.includes('Hiker'));
    assert.ok(DEFAULT_SUBJECT_TYPES.includes('Other'));
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
