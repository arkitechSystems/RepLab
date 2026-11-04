import { describe, it, expect } from 'vitest';
import { COMMUNITY_SHARE_CATEGORIES, applyCommunityToggle } from './communitySharing';

const ALL_ON = { all: true, pr: true, program: true, programComplete: true, streak: true };
const ALL_OFF = { all: false, pr: false, program: false, programComplete: false, streak: false };

describe('RepLab Community sharing toggles', () => {
  it('has one toggle per feed kind', () => {
    expect(COMMUNITY_SHARE_CATEGORIES.map((c) => c.key)).toEqual(['pr', 'program', 'programComplete', 'streak']);
  });

  it('master off switches every toggle off; master on switches them all on', () => {
    expect(applyCommunityToggle({ ...ALL_ON, streak: false }, 'all', false)).toEqual(ALL_OFF);
    expect(applyCommunityToggle(ALL_OFF, 'all', true)).toEqual(ALL_ON);
  });

  it('individual toggles work on their own while the master is on', () => {
    expect(applyCommunityToggle(ALL_ON, 'streak', false)).toEqual({ ...ALL_ON, streak: false });
  });

  it('turning every individual toggle off leaves the master on', () => {
    let s = ALL_ON;
    for (const { key } of COMMUNITY_SHARE_CATEGORIES) s = applyCommunityToggle(s, key, false);
    expect(s).toEqual({ ...ALL_OFF, all: true });
  });

  it('turning one on while the master is off turns the master back on (just that one)', () => {
    expect(applyCommunityToggle(ALL_OFF, 'pr', true)).toEqual({ ...ALL_OFF, all: true, pr: true });
  });
});
