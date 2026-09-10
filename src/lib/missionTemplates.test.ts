import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildTemplateKeywords,
    DEFAULT_TEMPLATE_ID,
    findSarTemplate,
    isSarTemplateName,
    resolveSearchOpTemplate,
    withDefaultTemplate,
    type MissionTemplateItem,
} from './missionTemplates.ts';

function tmpl(
    id: string,
    name: string,
    keywords: string[] = [],
): MissionTemplateItem {
    return { id, name, keywords };
}

test('isSarTemplateName matches SAR case-insensitively', () => {
    assert.equal(isSarTemplateName('SAR'), true);
    assert.equal(isSarTemplateName(' sar '), true);
    assert.equal(isSarTemplateName('Sar'), true);
    assert.equal(isSarTemplateName('Search'), false);
    assert.equal(isSarTemplateName(''), false);
    assert.equal(isSarTemplateName(undefined), false);
});

test('findSarTemplate returns the named SAR item', () => {
    const items = [tmpl('a', 'Rescue'), tmpl('b', 'sar'), tmpl('c', 'SAR Extra')];
    const found = findSarTemplate(items);
    assert.equal(found?.id, 'b');
});

test('resolveSearchOpTemplate prefers a saved id that is still listed', () => {
    const items = [tmpl('a', 'Rescue'), tmpl('b', 'SAR')];
    const resolved = resolveSearchOpTemplate(items, 'a');
    assert.equal(resolved?.id, 'a');
});

test('resolveSearchOpTemplate falls back to SAR when saved id is missing', () => {
    const items = [tmpl('a', 'Rescue'), tmpl('b', 'SAR')];
    assert.equal(resolveSearchOpTemplate(items, 'gone')?.id, 'b');
    assert.equal(resolveSearchOpTemplate(items, '')?.id, 'b');
    assert.equal(resolveSearchOpTemplate(items, DEFAULT_TEMPLATE_ID)?.id, 'b');
});

test('resolveSearchOpTemplate returns undefined when neither saved id nor SAR exists', () => {
    const items = [tmpl('a', 'Rescue')];
    assert.equal(resolveSearchOpTemplate(items, ''), undefined);
    assert.equal(resolveSearchOpTemplate(items, 'gone'), undefined);
});

test('buildTemplateKeywords copies keywords and adds template:id', () => {
    assert.deepEqual(
        buildTemplateKeywords(tmpl('abc', 'SAR', ['foo', 'foo', 'bar'])),
        ['foo', 'bar', 'template:abc'],
    );
});

test('buildTemplateKeywords skips the fake Default id', () => {
    assert.deepEqual(
        buildTemplateKeywords(tmpl(DEFAULT_TEMPLATE_ID, 'Default', ['x'])),
        ['x'],
    );
    assert.deepEqual(buildTemplateKeywords(undefined), []);
    assert.deepEqual(buildTemplateKeywords(null), []);
});

test('withDefaultTemplate prepends the synthetic Default tile', () => {
    const items = [tmpl('a', 'SAR')];
    const listed = withDefaultTemplate(items);
    assert.equal(listed[0].id, DEFAULT_TEMPLATE_ID);
    assert.equal(listed[1].id, 'a');
});
