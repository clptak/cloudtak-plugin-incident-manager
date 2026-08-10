/**
 * Pinned to a real WinCASIE III trail.txt ("Richardson2", 2026-08-09):
 * O'Connor weights rebase so each respondent's worst-used letter = 1, and
 * final POA is the plain mean across respondents.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    consensusForSegment,
    consensusRow,
    oconnorValues,
    proportionalValues,
    type ConsensusRespondent,
    type OconnorLetter,
} from '../lib/consensus.ts';

const SEGS = ['s1', 's2', 's3', 's4'];

function respondent(row: number, letterList: OconnorLetter[]): ConsensusRespondent {
    const letters: Record<string, OconnorLetter> = {};
    letterList.forEach((l, i) => { letters[SEGS[i]] = l; });
    const values = oconnorValues(row, letters, SEGS);
    return { method: 'oconnor', row, letters, values } as unknown as ConsensusRespondent;
}

function r2(v: number): number { return Math.round(v * 100) / 100; }

test("O'Connor: WC3 trail JENKINS — letters A,I,D,F at ROW 30", () => {
    const v = oconnorValues(30, { s1: 'A', s2: 'I', s3: 'D', s4: 'F' }, SEGS);
    assert.deepEqual([r2(v.s1), r2(v.s2), r2(v.s3), r2(v.s4)], [31.5, 3.5, 21, 14]);
});

test("O'Connor: WC3 trail JEBEDIAH — rebased weights for C,E,A,G at ROW 15", () => {
    // Without rebasing this would be 9:7:5:3 of 85; WC3 gives 7:5:3:1.
    const v = oconnorValues(15, { s1: 'C', s2: 'E', s3: 'A', s4: 'G' }, SEGS);
    assert.deepEqual([r2(v.s1), r2(v.s2), r2(v.s3), r2(v.s4)], [26.56, 15.94, 37.19, 5.31]);
});

test('Proportional: WC3 screenshot — ratings 100/25/50/75 at ROW 15', () => {
    // Ratings are relative weights, not percentages: 85% split as 100:25:50:75.
    const v = proportionalValues(15, { s1: 100, s2: 25, s3: 50, s4: 75 }, SEGS);
    assert.deepEqual([r2(v.s1), r2(v.s2), r2(v.s3), r2(v.s4)], [34, 8.5, 17, 25.5]);
});

test('Mixed-method consensus table matches WC3 screenshot', () => {
    // JENKINS O'Connor A,C,G,I @30; BUBBA O'Connor I,G,C,A @20;
    // JEBEDIAH Proportional 100,25,50,75 @15 → consensus 23.17/15.00/18.50/21.67.
    const respondents = [
        respondent(30, ['A', 'C', 'G', 'I']),
        respondent(20, ['I', 'G', 'C', 'A']),
        {
            method: 'proportional', row: 15, letters: {},
            values: proportionalValues(15, { s1: 100, s2: 25, s3: 50, s4: 75 }, SEGS),
        } as unknown as ConsensusRespondent,
    ];
    assert.equal(r2(consensusRow(respondents)), 21.67);
    assert.equal(r2(consensusForSegment(respondents, 's1')), 23.17);
    assert.equal(r2(consensusForSegment(respondents, 's2')), 15);
    assert.equal(r2(consensusForSegment(respondents, 's3')), 18.5);
    assert.equal(r2(consensusForSegment(respondents, 's4')), 21.67);
});

test("O'Connor: full Richardson2 consensus POAs match WC3", () => {
    const respondents = [
        respondent(30, ['A', 'I', 'D', 'F']),   // JENKINS
        respondent(20, ['I', 'F', 'D', 'A']),   // BUBBA
        respondent(15, ['C', 'E', 'A', 'G']),   // JEBEDIAH
    ];
    assert.equal(r2(consensusRow(respondents)), 21.67);
    assert.equal(r2(consensusForSegment(respondents, 's1')), 20.69);
    assert.equal(r2(consensusForSegment(respondents, 's2')), 11.81);
    assert.equal(r2(consensusForSegment(respondents, 's3')), 27.4);
    assert.equal(r2(consensusForSegment(respondents, 's4')), 18.44);
});
