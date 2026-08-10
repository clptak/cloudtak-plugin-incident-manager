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
