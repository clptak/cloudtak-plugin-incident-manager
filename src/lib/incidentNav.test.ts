import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    ALL_NAV_ITEMS,
    NAV_SECTIONS,
    navGroupHeading,
    sectionKeyForNavItem,
    visibleNavSections,
} from './incidentNav.ts';
import { SEARCH_ONLY_NAV_KEYS } from './incidentType.ts';

function headings(items: ReturnType<typeof visibleNavSections>[number]['items']): (string | null)[] {
    return items.map((_, i) => navGroupHeading(items, i));
}

test('search incidents: Initial Response has Investigation / Containment / Search sub-headings', () => {
    const initial = visibleNavSections(true).find((s) => s.key === 'h-initial');
    assert.ok(initial);
    assert.deepEqual(initial.items.map((i) => [i.group, i.key]), [
        ['Investigation', 'initial-information'],
        ['Investigation', 'subject-info'],
        ['Investigation', 'search-urgency'],
        ['Investigation', 'search-scenarios'],
        ['Containment', 'physical-wisar'],
        ['Containment', 'lpb-distances'],
        ['Search', 'ir-briefing'],
        ['Search', 'incident-post'],
        ['Search', 'resources'],
        ['Search', 'work-assignments'],
        ['Search', 'ics-201'],
    ]);
    assert.deepEqual(headings(initial.items), [
        'Investigation', null, null, null, 'Containment', null, 'Search', null, null, null, null,
    ]);
    assert.equal(initial.items.find((i) => i.key === 'physical-wisar')?.label, 'Motion Model Tools');
    assert.equal(initial.items.find((i) => i.key === 'lpb-distances')?.label, 'LPB Distances');
});

test('non-search incidents: same flat Initial Response list as before, no sub-headings or WiSAR', () => {
    const initial = visibleNavSections(false).find((s) => s.key === 'h-initial');
    assert.ok(initial);
    assert.deepEqual(initial.items.map((i) => i.key), [
        'initial-information', 'subject-info', 'ir-briefing', 'incident-post', 'resources', 'work-assignments', 'ics-201',
    ]);
    assert.ok(initial.items.every((i) => i.group === undefined));
    assert.ok(headings(initial.items).every((h) => h === null));
});

test('non-search filtering does not alter the shared NAV_SECTIONS', () => {
    visibleNavSections(false);
    const initial = NAV_SECTIONS.find((s) => s.key === 'h-initial');
    assert.equal(initial?.items.find((i) => i.key === 'resources')?.group, 'Search');
});

test('only Initial Response is grouped; other sections are unchanged', () => {
    for (const section of NAV_SECTIONS.filter((s) => s.key !== 'h-initial')) {
        assert.ok(section.items.every((i) => i.group === undefined), section.key);
    }
});

test('Motion Model Tools is a search-only nav key in Initial Response', () => {
    assert.ok(SEARCH_ONLY_NAV_KEYS.has('physical-wisar'));
    assert.equal(sectionKeyForNavItem('physical-wisar'), 'h-initial');
    assert.ok(ALL_NAV_ITEMS.some((i) => i.key === 'physical-wisar'));
    assert.ok(SEARCH_ONLY_NAV_KEYS.has('lpb-distances'));
    assert.equal(sectionKeyForNavItem('lpb-distances'), 'h-initial');
});

test('navGroupHeading handles ungrouped items and bounds', () => {
    const items = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B', group: 'G' }, { key: 'c', label: 'C', group: 'G' }];
    assert.deepEqual(items.map((_, i) => navGroupHeading(items, i)), [null, 'G', null]);
    assert.equal(navGroupHeading(items, 5), null);
});
