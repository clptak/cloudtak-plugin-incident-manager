import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyDeploymentDefaults,
    deploymentFromConfig,
    hasDeploymentDefaults,
    parseLpbTable,
    parseLpbTableJson,
    parseStoredPluginSettings,
    parseWisarUrl,
    resolveDeployment,
    settingsForStorage,
    type ResolvedDeployment,
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

test('parseStoredPluginSettings reads and normalizes wisarUrl', () => {
    assert.equal(parseStoredPluginSettings({}).wisarUrl, '');
    assert.equal(parseStoredPluginSettings({ wisarUrl: ' https://wisar.example.org/api/v1/ ' }).wisarUrl,
        'https://wisar.example.org');
    assert.equal(parseStoredPluginSettings({ wisarUrl: 'wisar.example.org' }).wisarUrl, 'https://wisar.example.org');
    assert.equal(parseStoredPluginSettings({ wisarUrl: 'ftp://nope' }).wisarUrl, '');
    assert.equal(parseStoredPluginSettings({ wisarUrl: 42 }).wisarUrl, '');
});

test('parseWisarUrl: blank, valid, invalid', () => {
    assert.equal(parseWisarUrl('  '), '');
    assert.equal(parseWisarUrl('http://localhost:8760/'), 'http://localhost:8760');
    assert.equal(parseWisarUrl('ftp://x'), null);
});

const deployed: ResolvedDeployment = {
    yourAgency: 'County SAR',
    searchOpTemplateId: 'tmpl-sar-1',
    wisarUrl: 'https://wisar.example.org',
    useD4hAidingAgencies: false,
    useD4hPersonnel: false,
    subjectTypes: ['Climber', 'Hiker'],
    aidingAgencies: ['Forest Service', 'Sheriff'],
    personnel: [{ id: 1, name: 'Smith, Jane', ref: '42' }],
    lpbTable: [validLpbRow],
};

test('resolveDeployment does not throw when no config.local.ts is bundled', () => {
    const resolved = resolveDeployment();
    assert.equal(resolved.yourAgency, '');
    assert.equal(resolved.wisarUrl, '');
    assert.equal(hasDeploymentDefaults(resolved), false);
});

test('deploymentFromConfig reads scalars and staged list files', () => {
    const resolved = deploymentFromConfig({
        yourAgency: '  County SAR  ',
        wisarUrl: 'https://wisar.example.org/api/v1/',
        useD4hPersonnel: false,
        subjectTypesFile: 'subject-types.json',
        aidingAgenciesFile: '../secret.json',
        personnelFile: 'personnel.csv',
        lpbTableFile: 'missing.json',
    }, {
        'subject-types.json': '{ "subjectTypes": ["Child", "Elderly"] }',
        'secret.json': '["Nope"]',
        'personnel.csv': 'id,name,callsign\n7,Ada Lovelace,ADA\n',
        'bad-lpb.json': '{ "category": "Nope" }',
    });
    assert.equal(resolved.yourAgency, 'County SAR');
    assert.equal(resolved.wisarUrl, 'https://wisar.example.org');
    assert.equal(resolved.useD4hPersonnel, false);
    assert.equal(resolved.useD4hAidingAgencies, undefined);
    assert.deepEqual(resolved.subjectTypes, ['Child', 'Elderly']);
    assert.equal(resolved.aidingAgencies, undefined);
    assert.deepEqual(resolved.personnel, [{ id: 7, name: 'Ada Lovelace', callsign: 'ADA' }]);
    assert.equal(resolved.lpbTable, undefined);
});

test('deploymentFromConfig ignores an invalid staged file', () => {
    const resolved = deploymentFromConfig({
        lpbTableFile: 'lpb.json',
    }, {
        'lpb.json': '{ "category": "Nope" }',
    });
    assert.equal(resolved.lpbTable, undefined);
});

test('applyDeploymentDefaults fills blanks from deployment and lets saved values win', () => {
    const fresh = applyDeploymentDefaults(null, deployed);
    assert.equal(fresh.yourAgency, 'County SAR');
    assert.equal(fresh.useD4hAidingAgencies, false);
    assert.deepEqual(fresh.subjectTypes, ['Climber', 'Hiker']);
    assert.equal(fresh.lpbTable?.[0].category, 'Hiker');

    const overridden = applyDeploymentDefaults({
        yourAgency: '  Other SAR  ',
        searchOpTemplateId: '',
        wisarUrl: '',
        useD4hAidingAgencies: true,
        aidingAgencies: [],
        personnel: [],
        lpbTable: null,
    }, deployed);
    assert.equal(overridden.yourAgency, 'Other SAR');
    assert.equal(overridden.searchOpTemplateId, 'tmpl-sar-1');
    assert.equal(overridden.wisarUrl, 'https://wisar.example.org');
    assert.equal(overridden.useD4hAidingAgencies, true);
    assert.equal(overridden.useD4hPersonnel, false);
    assert.deepEqual(overridden.aidingAgencies, []);
    assert.deepEqual(overridden.personnel, []);
    assert.equal(overridden.lpbTable, null);
    assert.deepEqual(overridden.subjectTypes, ['Climber', 'Hiker']);
});

test('settingsForStorage drops strings and lists that match deployment', () => {
    const settings = applyDeploymentDefaults(null, deployed);
    const stored = settingsForStorage(settings, deployed);
    assert.equal(stored.yourAgency, '');
    assert.equal(stored.searchOpTemplateId, '');
    assert.equal(stored.wisarUrl, '');
    assert.equal(stored.useD4hAidingAgencies, false);
    assert.equal('subjectTypes' in stored, false);
    assert.equal('aidingAgencies' in stored, false);
    assert.equal('personnel' in stored, false);
    assert.equal('lpbTable' in stored, false);

    const custom = settingsForStorage({
        ...settings,
        yourAgency: 'Other SAR',
        lpbTable: null,
    }, deployed);
    assert.equal(custom.yourAgency, 'Other SAR');
    assert.equal(custom.lpbTable, null);
});

test('omitted storage keys load the deployment value again', () => {
    const settings = applyDeploymentDefaults(null, deployed);
    const stored = settingsForStorage(settings, deployed);
    const again = applyDeploymentDefaults(stored, deployed);
    assert.equal(again.yourAgency, 'County SAR');
    assert.equal(again.wisarUrl, 'https://wisar.example.org');
    assert.deepEqual(again.subjectTypes, ['Climber', 'Hiker']);
    assert.equal(again.lpbTable?.[0].category, 'Hiker');
    assert.equal(again.useD4hPersonnel, false);
});

test('hasDeploymentDefaults is true when a string or staged list is present', () => {
    assert.equal(hasDeploymentDefaults({
        yourAgency: '',
        searchOpTemplateId: '',
        wisarUrl: '',
    }), false);
    assert.equal(hasDeploymentDefaults({
        yourAgency: 'County SAR',
        searchOpTemplateId: '',
        wisarUrl: '',
    }), true);
    assert.equal(hasDeploymentDefaults({
        yourAgency: '',
        searchOpTemplateId: '',
        wisarUrl: '',
        aidingAgencies: ['NPS'],
    }), true);
});
