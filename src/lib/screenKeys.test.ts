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
    const collections = new Set(['segments', 'row-segments', 'resources', 'work-assignments', 'op-assignments',
        'clues', 'iap', 'cad-remarks', 'cad-logs']);
    for (const [screen, list] of Object.entries(SCREEN_EDIT_KEYS)) {
        for (const key of list) {
            if (key.endsWith('.')) {
                assert.match(key, /^c\.[a-z-]+\.$/, `${screen}: ${key}`);
                assert.ok(collections.has(key.slice(2, -1)), `${screen}: ${key} is not a collection`);
            } else {
                assert.ok(keys.has(key), `${screen}: ${key} is not a codec key`);
            }
        }
    }
});

test('screenChangedKeys: only what the open screen edits', () => {
    const changed = ['s.incident-response.subjects', 'op.1.debrief.x.y', 's.cad-data'];
    assert.deepEqual(screenChangedKeys('subject-info', changed), ['s.incident-response.subjects']);
    assert.deepEqual(screenChangedKeys('initial-information', changed), ['s.cad-data']);
    assert.deepEqual(screenChangedKeys('htab:dashboard', changed), []);
});

test('screenChangedKeys: collection prefixes match their records; IAP timestamps alone do not', () => {
    assert.deepEqual(screenChangedKeys('segmentation', ['c.segments.abc', 'c.resources.r1']), ['c.segments.abc']);
    assert.deepEqual(screenChangedKeys('operational-periods', ['c.iap.1.updated']), []);
    assert.deepEqual(screenChangedKeys('operational-periods', ['c.iap.1.objectives', 'c.iap.1.updated']), ['c.iap.1.objectives']);
});

test('keyLabel: collection keys', () => {
    assert.equal(keyLabel('c.segments.abc'), 'Segments');
    assert.equal(keyLabel('c.iap.2.objectives'), 'OP2 IAP');
    assert.deepEqual(keyLabels(['c.cad-remarks.a', 'c.cad-logs.b']), ['CAD notes']);
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
    assert.ok(touchesPrefixes(['c.segments.abc'], OP_LIST_PREFIXES));
    assert.ok(touchesPrefixes(['c.op-assignments.1-x'], OP_LIST_PREFIXES));
    assert.ok(!touchesPrefixes(['s.incident-response.subjects'], OP_LIST_PREFIXES));
});
