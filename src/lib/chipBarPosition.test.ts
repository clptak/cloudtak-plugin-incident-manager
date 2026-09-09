import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DOCK_GAP,
    TOP_RIGHT_GUTTER_PX,
    ZOOM_STACK_TOP,
    ZOOM_STACK_WIDTH,
    clampOutFromNav,
    clampToShell,
    dockedMaxWidth,
    dockedPosition,
    isDesktopWidth,
    parseSavedPos,
    rectsIntersect,
    type Rect,
} from './chipBarPosition.ts';

const shell: Rect = { left: 0, top: 0, right: 1400, bottom: 900, width: 1400, height: 900 };
const mission: Rect = { left: 8, top: 8, right: 280, bottom: 68, width: 272, height: 60 };
const leftControls: Rect = { left: 8, top: 76, right: 48, bottom: 220, width: 40, height: 144 };

test('parseSavedPos accepts a point and rejects junk', () => {
    assert.equal(parseSavedPos(null), null);
    assert.equal(parseSavedPos('{'), null);
    assert.equal(parseSavedPos('{"x":1}'), null);
    assert.deepEqual(parseSavedPos('{"x":40,"y":80}'), { x: 40, y: 80 });
});

test('docks to the right of DataSync when navigation is off', () => {
    assert.deepEqual(dockedPosition({
        shell,
        activeMission: mission,
        leftControls,
        navActive: false,
        isDesktop: true,
    }), {
        x: mission.right + DOCK_GAP,
        y: mission.top,
    });
});

test('docks below the nav banner to the right of the zoom stack on desktop', () => {
    assert.deepEqual(dockedPosition({
        shell,
        activeMission: mission,
        leftControls,
        navActive: true,
        isDesktop: true,
    }), {
        x: leftControls.right + DOCK_GAP,
        y: leftControls.top,
    });
});

test('stays beside DataSync when navigation is on at mobile width', () => {
    assert.deepEqual(dockedPosition({
        shell,
        activeMission: mission,
        leftControls,
        navActive: true,
        isDesktop: false,
    }), {
        x: mission.right + DOCK_GAP,
        y: mission.top,
    });
});

test('falls back to zoom-stack constants when left controls are missing', () => {
    assert.deepEqual(dockedPosition({
        shell,
        activeMission: mission,
        leftControls: null,
        navActive: true,
        isDesktop: true,
    }), {
        x: DOCK_GAP + ZOOM_STACK_WIDTH + DOCK_GAP,
        y: ZOOM_STACK_TOP,
    });
});

test('leaves a top-right gutter on the DataSync row', () => {
    const pos = { x: 288, y: 8 };
    assert.equal(dockedMaxWidth(pos, 1400, true), 1400 - 288 - TOP_RIGHT_GUTTER_PX);
    assert.equal(dockedMaxWidth(pos, 1400, false), 1400 - 288 - DOCK_GAP);
});

test('clamps an undocked pane inside the map shell', () => {
    assert.deepEqual(
        clampToShell({ x: -20, y: 10 }, { width: 200, height: 60 }, { width: 400, height: 300 }),
        { x: 0, y: 10 },
    );
    assert.deepEqual(
        clampToShell({ x: 500, y: 500 }, { width: 200, height: 60 }, { width: 400, height: 300 }),
        { x: 200, y: 240 },
    );
});

test('drops an overlapping undocked pane just below the nav banner', () => {
    const nav: Rect = { left: 380, top: 0, right: 1020, bottom: 70, width: 640, height: 70 };
    assert.deepEqual(
        clampOutFromNav({ x: 400, y: 10 }, { width: 200, height: 60 }, nav, shell),
        { x: 400, y: 70 + DOCK_GAP },
    );
    assert.deepEqual(
        clampOutFromNav({ x: 8, y: 120 }, { width: 200, height: 60 }, nav, shell),
        { x: 8, y: 120 },
    );
});

test('reports desktop at the 768px nav-banner breakpoint', () => {
    assert.equal(isDesktopWidth(767), false);
    assert.equal(isDesktopWidth(768), true);
});

test('detects intersecting rectangles', () => {
    assert.equal(rectsIntersect(mission, leftControls), false);
    assert.equal(rectsIntersect(mission, { ...mission, left: 200, right: 300 }), true);
});
