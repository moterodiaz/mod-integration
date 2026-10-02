import assert from 'node:assert/strict';
import { deriveDeadlines, todayET, normalizeHref, resolveHref, cohortFromHref, textToFaq, faqToText } from './banter.js';
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
// Mentee windows open on deck approval, not a milestone's start: the range
// supplies only the close, and the approval-set open survives unchanged.
assert.deepEqual(menteeOpenFromRange.students, { open: '2026-08-20', close: '2026-10-15' });
const menteeRangeNoApproval = deriveDeadlines([
  { date: '2026-09-09', end: '2026-10-15', cells: [link('students')] },
]);
assert.deepEqual(menteeRangeNoApproval.students, { close: '2026-10-15' });
// cohort= need not be the first query parameter.
const notFirstParam = deriveDeadlines([
  { date: '2026-10-01', cells: [{ href: '/apply/?source=timeline&cohort=mentor_alums' }] },
]);
assert.deepEqual(notFirstParam.mentor_alums, { close: '2026-10-01' });
// But a cohort param on a different page (decks) is not an application link.
const decksLink = deriveDeadlines([
  { date: '2026-10-01', cells: [{ href: '/decks/?cohort=students' }] },
]);
assert.equal(decksLink.students, undefined);
// Removing every linked milestone drops a stale close; an approval-set open
// survives because it exists independently of milestones.
const removed = deriveDeadlines([], {
  students: { open: '2026-09-01', close: '2026-10-15' },
  mentor_alums: { open: '2026-08-25', close: '2026-10-01' },
});
assert.deepEqual(removed.students, { open: '2026-09-01' });
assert.deepEqual(removed.mentor_alums, { open: '2026-08-25' });
assert.equal(deriveDeadlines([]).young_alums, undefined);
assert.match(todayET(), /^\d{4}-\d{2}-\d{2}$/);

// FAQ text round-trips answers containing lines that look like markers.
const faq = [
  { q: 'Format?', a: 'Example:\nQ: Can I join?\nA: Yes' },
  { q: 'Regex?', a: 'Use \\d+ and \\Q: stays literal' },
];
assert.deepEqual(textToFaq(faqToText(faq)), faq);
assert.equal(textToFaq('Q: hi\nfirst\n\nQ: two\nsecond').length, 2);
assert.throws(() => textToFaq('no marker'));

// Dead olinalumni.org links rewrite to site paths, with or without a scheme.
assert.equal(normalizeHref('https://www.olinalumni.org/resources/banter/apply/?cohort=students'), 'apply/?cohort=students');
assert.equal(normalizeHref('www.olinalumni.org/apply/?cohort=students'), 'apply/?cohort=students');
assert.equal(normalizeHref('https://example.com/jobs/apply/now'), 'https://example.com/jobs/apply/now');
// resolveHref links only valid forms; bare tokens stay plain text.
assert.equal(resolveHref('foo'), null);
assert.equal(resolveHref('javascript:alert(1)'), null);
assert.ok(resolveHref('apply/?cohort=students'));
assert.ok(resolveHref('/resources/banter/apply/?cohort=students'));
assert.ok(resolveHref('https://example.com/x'));
console.log('deriveDeadlines checks passed');

// normalizeHref — known-dead olinalumni.org forms get rewritten
assert.equal(normalizeHref('https://www.olinalumni.org/resources/banter/apply/?cohort=mentor_alums'), 'apply/?cohort=mentor_alums');
assert.equal(normalizeHref('https://olinalumni.org/resources/banter/apply/?cohort=mentor_alums'), 'apply/?cohort=mentor_alums');
assert.equal(normalizeHref('/resources/banter/apply/?cohort=students'), 'apply/?cohort=students');
assert.equal(normalizeHref('/resources/banter/decks/?cohort=students'), 'decks/?cohort=students');
// already-normalized relative forms are unchanged
assert.equal(normalizeHref('apply/?cohort=students'), 'apply/?cohort=students');
assert.equal(normalizeHref('/apply/?cohort=students'), 'apply/?cohort=students');
// slash-less form
assert.equal(normalizeHref('apply?cohort=students'), 'apply?cohort=students');
// fragment is preserved
assert.equal(normalizeHref('apply/?cohort=students#section'), 'apply/?cohort=students#section');
// any other host passes through untouched
assert.equal(normalizeHref('https://docs.google.com/forms/123'), 'https://docs.google.com/forms/123');
assert.equal(normalizeHref('https://example.com/jobs/apply/now'), 'https://example.com/jobs/apply/now');
assert.equal(normalizeHref('https://forms.gle/decks/x'), 'https://forms.gle/decks/x');
console.log('normalizeHref checks passed');

// cohortFromHref on relative hrefs (no leading slash)
assert.equal(cohortFromHref('apply/?cohort=students'), 'students');
assert.equal(cohortFromHref('apply/?cohort=mentor_alums'), 'mentor_alums');
console.log('cohortFromHref relative checks passed');

// textToFaq / faqToText round trip
const faqSingle = [{ q: 'What time?', a: 'We start at 3pm.' }];
assert.deepEqual(textToFaq(faqToText(faqSingle)), faqSingle);
// multi-paragraph answer
const faqMulti = [{ q: 'Detail?', a: 'First paragraph.\n\nSecond paragraph.' }];
assert.deepEqual(textToFaq(faqToText(faqMulti)), faqMulti);
// two entries round-trip
const faqTwo = [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }];
assert.deepEqual(textToFaq(faqToText(faqTwo)), faqTwo);
// text before first Q: throws
assert.throws(() => textToFaq('some text\nQ: question'), /Q:/);
assert.throws(() => textToFaq('no questions at all'), /Q:/);
// empty input returns []
assert.deepEqual(textToFaq(''), []);
assert.deepEqual(textToFaq('\n\n'), []);
console.log('textToFaq/faqToText checks passed');
