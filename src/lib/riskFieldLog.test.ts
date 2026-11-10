import { test } from 'node:test';
import assert from 'node:assert/strict';

import { riskFieldLogEntry } from './riskFieldLog.ts';

test('riskFieldLogEntry: GAR entry names the tactic, respondent, score and recommendation', () => {
    const e = riskFieldLogEntry('gar', ' Hasty search ', {
        name: ' J. Smith ', score: 42, level: 'Amber (Caution)', recommendation: 'Mitigate before starting.',
    });
    assert.equal(e.content, 'GAR risk assessment of "Hasty search" by J. Smith: 42/80 Amber (Caution). Mitigate before starting.');
    assert.deepEqual(e.keywords, ['risk-assessment', 'risk-gar', 'level:Amber (Caution)', 'score:42', 'tactic:Hasty search']);
});

test('riskFieldLogEntry: complacency and SPE are out of 100; blank tactic and recommendation left out', () => {
    assert.equal(
        riskFieldLogEntry('comp', '', { name: 'K. Lee', score: 64, level: 'Moderate Complacency', recommendation: '' }).content,
        'Complacency risk assessment by K. Lee: 64/100 Moderate Complacency.',
    );
    const spe = riskFieldLogEntry('spe', 'Ridge', { name: 'A', score: 20, level: 'Low', recommendation: 'Proceed.' });
    assert.equal(spe.content, 'SPE risk assessment of "Ridge" by A: 20/100 Low. Proceed.');
    assert.ok(spe.keywords.includes('risk-spe'));
});
