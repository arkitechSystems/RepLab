// Shared bits for every workout message users send out (Facebook, Instagram,
// texts, Messenger). The app link is a smart link: server/index.js /get
// sends the person who taps it to the App Store on iPhone, Google Play on
// Android, and the website everywhere else — so one link works no matter
// what phone the sender or the recipient has.
export const APP_LINK = 'https://replab-fitness.com/get';

export const APP_SHARE_FOOTER = `Download the app or check it out at RepLab-Fitness.com\n${APP_LINK}`;

// Workout names go in parentheses in shared messages, e.g. "(Push Day)".
export function workoutLabel(name) {
  return `(${(name || 'Workout').trim()})`;
}
