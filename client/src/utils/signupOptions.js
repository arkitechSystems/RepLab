// Shared by Signup.jsx and CompleteProfile.jsx (the optional step after a
// Google/Apple sign-up) so both ask the same questions the same way.

export const REFERRAL_OPTIONS = [
  { value: '', label: 'Select one...' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube Ad' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google', label: 'Google Search' },
  { value: 'info_card', label: 'Info card' },
  { value: 'friend', label: 'Friend / Word of Mouth' },
  { value: 'other', label: 'Other' },
];

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

// "How did you hear about us?" → stored referral_source string. "Other" and
// "Friend" carry their free-text follow-up, e.g. "Friend: Sam".
export function buildReferralSource(referralSource, referralOther) {
  if (referralSource === 'other') return `Other: ${referralOther}`;
  if (referralSource === 'friend' && referralOther.trim()) return `Friend: ${referralOther.trim()}`;
  return referralSource;
}
