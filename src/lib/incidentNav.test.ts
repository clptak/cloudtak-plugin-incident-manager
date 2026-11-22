import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    ALL_NAV_ITEMS,
    NAV_SECTIONS,
    navGroupHeading,
    sectionKeyForNavItem,
    visibleIncidentNavItems,
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
        ['Search', 'ics-201'],
    ]);
    assert.deepEqual(headings(initial.items), [
        'Investigation', null, null, null, 'Containment', null, 'Search', null, null,
    ]);
    assert.equal(initial.items.find((i) => i.key === 'physical-wisar')?.label, 'Motion Model Tools');
    assert.equal(initial.items.find((i) => i.key === 'lpb-distances')?.label, 'Lost Person Behavior');
});

test('non-search incidents: same flat Initial Response list as before, no sub-headings or WiSAR', () => {
    const initial = visibleNavSections(false).find((s) => s.key === 'h-initial');
    assert.ok(initial);
    assert.deepEqual(initial.items.map((i) => i.key), [
        'initial-information', 'subject-info', 'ir-briefing', 'incident-post', 'ics-201',
    ]);
    assert.ok(initial.items.every((i) => i.group === undefined));
    assert.ok(headings(initial.items).every((h) => h === null));
});

test('non-search filtering does not alter the shared NAV_SECTIONS', () => {
    visibleNavSections(false);
    const initial = NAV_SECTIONS.find((s) => s.key === 'h-initial');
    assert.equal(initial?.items.find((i) => i.key === 'ir-briefing')?.group, 'Search');
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

test('help pop-outs show only for search incidents (#42)', () => {
    const search = visibleNavSections(true);
    assert.equal(search.find((s) => s.key === 'h-initial')?.helpKey, 'route-location-search');
    assert.ok(search.some((s) => s.helpKey === 'area-search'));
    for (const section of visibleNavSections(false)) {
        assert.equal(section.helpKey, undefined, section.key);
        assert.ok(section.items.every((i) => i.helpKey === undefined), section.key);
    }
});

test('the former horizontal tabs are pinned incident items; Clues only for search (#44)', () => {
    assert.deepEqual(visibleIncidentNavItems(true).map((i) => i.label), [
        'Dashboard', 'Incident Summary', 'Logs', 'Tasks & Checklists', 'Personnel', 'Resources & Assignments', 'Clues',
    ]);
    assert.deepEqual(visibleIncidentNavItems(false).map((i) => i.key), [
        'dashboard', 'incident-summary', 'logs', 'task', 'organization', 'resources',
    ]);
    // Resources & Assignments moved out of Initial Response.
    assert.ok(visibleNavSections(true).every((s) => s.items.every((i) => i.key !== 'resources')));
});

test('CASIE sits in Area Search; Risk Management follows it for every type (#44)', () => {
    const search = visibleNavSections(true);
    const area = search.findIndex((s) => s.key === 'h-area');
    assert.deepEqual(search[area].items.map((i) => i.key), ['operational-periods', 'casie']);
    assert.equal(search[area + 1].label, 'Risk Management');
    const other = visibleNavSections(false);
    const ops = other.find((s) => s.key === 'h-area');
    assert.deepEqual(ops?.items.map((i) => i.key), ['operational-periods']);
    assert.deepEqual(other.find((s) => s.key === 'h-risk')?.items.map((i) => i.key), ['risk-assessment']);
});
