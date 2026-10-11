import assert from 'node:assert/strict';
import { test } from 'node:test';
import template from '../data/mission_schema.json' with { type: 'json' };
import type { MissionSchema } from './missionSchema.ts';
import { encodeSchema } from './schemaCodec.ts';
import {
    keyLabel,
    keyLabels,
    OP_LIST_PREFIXES,
    SCREEN_EDIT_KEYS,
    screenChangedKeys,
    screenId,
    touchesPrefixes,
} from './screenKeys.ts';

test('screenId: nav key on Main, htab:<key> elsewhere', () => {
    assert.equal(screenId('subject-info', 'main'), 'subject-info');
    assert.equal(screenId('subject-info', 'casie'), 'htab:casie');
});

test('every screen key is a key the codec can produce from the shipped template', () => {
    const s = JSON.parse(JSON.stringify(template)) as MissionSchema;
    const ir = s.incident_response as Record<string, unknown>;
    // Fields the template may leave out until first use.
    for (const f of ['subjects', 'ipp_coordinates', 'ipp_type', 'casie', 'casie_scenarios', 'urgency_rating',
        'scenarios', 'work_assignments', 'incident_post', 'resource_assignments', 'iap_plans', 'clues',
        'op_assignments']) {
        if (!(f in ir)) ir[f] = [];
    }
    for (const f of ['row_segments', 'segments', 'risk', 'default_agency', 'assignments_org_chart']) {
        if (!(f in s)) (s as Record<string, unknown>)[f] = {};
    }
    const keys = new Set(encodeSchema(s).keys());
    for (const [screen, list] of Object.entries(SCREEN_EDIT_KEYS)) {
        for (const key of list) assert.ok(keys.has(key), `${screen}: ${key} is not a codec key`);
    }
});

test('screenChangedKeys: only what the open screen edits', () => {
    const changed = ['s.incident-response.subjects', 'op.1.debrief.x.y', 's.cad-data'];
    assert.deepEqual(screenChangedKeys('subject-info', changed), ['s.incident-response.subjects']);
    assert.deepEqual(screenChangedKeys('initial-information', changed), ['s.cad-data']);
    assert.deepEqual(screenChangedKeys('htab:dashboard', changed), []);
});

test('keyLabel: known sections, op keys, and a readable fallback', () => {
    assert.equal(keyLabel('s.incident-response.subjects'), 'Subject Information');
    assert.equal(keyLabel('op.3.mission'), 'OP3');
    assert.equal(keyLabel('op.2.debrief.seg.abc'), 'OP2 debriefs');
    assert.equal(keyLabel('s.incident-response.new-thing'), 'new thing');
    assert.deepEqual(keyLabels(['s.event-id', 's.incident-id', 's.segments']), ['Initial Information', 'Segments']);
});

test('touchesPrefixes: OP list reloads on registry, debriefs and segments, not on unrelated keys', () => {
    assert.ok(touchesPrefixes(['op.1.debrief.a.b'], OP_LIST_PREFIXES));
    assert.ok(touchesPrefixes(['s.segments'], OP_LIST_PREFIXES));
    assert.ok(!touchesPrefixes(['s.incident-response.subjects'], OP_LIST_PREFIXES));
});
