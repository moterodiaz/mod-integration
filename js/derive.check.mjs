import assert from 'node:assert/strict';
import { deriveDeadlines, todayET } from './banter.js';
const link = (role) => ({ href: `/apply/?cohort=${role}` });
const previous = {
  students: { open: '2026-08-20' },
  mentor_alums: { open: '2026-08-25' },
  unrelated: { open: '2026-01-01' },
};
const snapshot = structuredClone(previous);
const actual = deriveDeadlines([
  { date: '2026-09-09', end: '2026-10-15', cells: [link('mentor_alums')] },
  { date: '2026-09-01', cells: [link('students')] },
  { date: '2026-09-03', cells: [link('students')] },
  { date: '2026-09-04', cells: [link('young_alums')] },
  { date: '2026-09-06', cells: [link('mentor_alums')] },
], previous);
assert.deepEqual(actual.mentor_alums, { open: '2026-09-09', close: '2026-10-15' });
assert.equal(actual.alumni, actual.mentor_alums);
assert.deepEqual(actual.students, { close: '2026-09-03', open: '2026-08-20' });
assert.deepEqual(actual.young_alums, { close: '2026-09-04' });
assert.deepEqual(actual.unrelated, { open: '2026-01-01' });
assert.deepEqual(previous, snapshot, 'deriveDeadlines must not mutate prev');
const closeOnlyMentor = deriveDeadlines([{ date: '2026-09-12', cells: [link('mentor_alums')] }]);
assert.deepEqual(closeOnlyMentor.mentor_alums, { close: '2026-09-12' });
const closeOnlyMentorWithApproval = deriveDeadlines(
  [{ date: '2026-09-12', cells: [link('mentor_alums')] }],
  { mentor_alums: { open: '2026-08-15' } },
);
assert.deepEqual(closeOnlyMentorWithApproval.mentor_alums, { close: '2026-09-12', open: '2026-08-15' });
const menteeOpenFromRange = deriveDeadlines([
  { date: '2026-09-09', end: '2026-10-15', cells: [link('students')] },
], { students: { open: '2026-08-20' } });
assert.deepEqual(menteeOpenFromRange.students, { open: '2026-09-09', close: '2026-10-15' });
assert.equal(deriveDeadlines([]).young_alums, undefined);
assert.match(todayET(), /^\d{4}-\d{2}-\d{2}$/);
console.log('deriveDeadlines checks passed');
