import { describe, it, expect } from 'vitest';
import { searchHelp, tokenize, editDistance, createHelpSearch } from './helpSearch';
import { HELP_FAQ, HELP_STARTER_IDS } from '../data/helpFaq';

const answerId = (q) => {
  const r = searchHelp(q);
  return r.status === 'answer' ? r.match.id : `(${r.status})`;
};

describe('helpFaq data', () => {
  it('has unique ids and complete entries', () => {
    const ids = HELP_FAQ.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(HELP_FAQ.length).toBeGreaterThanOrEqual(40);
    for (const e of HELP_FAQ) {
      expect(e.question).toBeTruthy();
      expect(e.answer).toBeTruthy();
      expect(Array.isArray(e.alternates)).toBe(true);
      expect(Array.isArray(e.keywords)).toBe(true);
      if (e.action) expect(e.action.to.startsWith('/')).toBe(true);
    }
  });

  it('starter chips point at real entries', () => {
    for (const id of HELP_STARTER_IDS) expect(ids()).toContain(id);
    function ids() { return HELP_FAQ.map((e) => e.id); }
  });

  it('never mentions owner-only features', () => {
    const text = JSON.stringify(HELP_FAQ).toLowerCase();
    expect(text).not.toMatch(/featured workout|challenge|trainer/);
    expect(JSON.stringify(HELP_FAQ)).not.toMatch(/REPLAB|Replab/);
  });
});

describe('tokenize', () => {
  it('drops filler words and stems', () => {
    expect(tokenize('How do I add a workout?')).toEqual(['add', 'workout']);
    expect(tokenize('Creating workouts')).toEqual(['create', 'workout']);
  });
  it('keeps two-word phrases together', () => {
    expect(tokenize('sign in with Google')).toContain('sign');
    expect(tokenize('warm up set')).toContain('warm');
  });
});

describe('editDistance', () => {
  it('counts single typos and swaps as 1', () => {
    expect(editDistance('calender', 'calendar')).toBe(1);
    expect(editDistance('wokrout', 'workout')).toBe(1);
  });
});

describe('searchHelp', () => {
  it.each([
    ['How do I add a workout?', 'create-workout'],
    ['create a workout', 'create-workout'],
    ['make my own workout', 'create-workout'],
    ['How do I add this to my calendar?', 'schedule-workout'],
    ['schedule a workout', 'schedule-workout'],
    ['how do i add a workout to my calender', 'schedule-workout'],
    ['how do i start a program', 'start-program'],
    ['begin program', 'start-program'],
    ['build a program', 'build-program'],
    ['duplicate week', 'program-weeks'],
    ['apply to all copies', 'program-copies'],
    ['how do I make a superset', 'supersets'],
    ['supersett', 'supersets'],
    ['plate calcluator', 'plate-calculator'],
    ['rest timer', 'rest-timer'],
    ['how long do I rest', 'rest-timer'],
    ['where are my PRs', 'personal-records'],
    ['delete my acount', 'delete-account'],
    ['forgot password', 'forgot-password'],
    ['dark mode', 'theme'],
    ['does it work offline', 'offline'],
    ['log as you go', 'log-as-you-go'],
    ['I missed a workout', 'missed-workouts'],
    ['share workout with friend', 'share-workout'],
    ['sign in with apple', 'apple-google-signin'],
    ['contact support', 'contact-support'],
    ['progress charts', 'progress'],
  ])('%s → %s', (q, id) => {
    expect(answerId(q)).toBe(id);
  });

  it('returns no match for nonsense', () => {
    for (const q of ['purple banana spaceship', 'asdfgh', 'how do i', '', "what's the weather"]) {
      const r = searchHelp(q);
      expect(r.status).toBe('none');
      expect(r.match).toBeNull();
    }
  });

  it('offers up to 3 suggestions when the match is weak', () => {
    const r = searchHelp('workot');
    expect(r.status).toBe('suggest');
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
  });

  it('suggests rather than guesses between two equally good entries', () => {
    const s = createHelpSearch([
      { id: 'a', question: 'How do I paint the fence?', alternates: [], keywords: [], answer: 'x' },
      { id: 'b', question: 'How do I paint the house?', alternates: [], keywords: [], answer: 'y' },
    ]);
    const r = s.search('paint');
    expect(r.status).toBe('suggest');
    expect(r.suggestions.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });
});

describe('every FAQ question finds itself', () => {
  it.each(HELP_FAQ.map((e) => [e.question, e.id]))('%s', (q, id) => {
    expect(answerId(q)).toBe(id);
  });
});
