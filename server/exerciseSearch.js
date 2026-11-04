// The server's exercise search: the shared module (../shared/exerciseSearch.js)
// wired to this package's Fuse.js. See that file for the rules.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import Fuse from 'fuse.js';
import { createExerciseSearch } from '../shared/exerciseSearch.js';

export { EXERCISE_ABBREVIATIONS, normalizeExerciseText, matchesExerciseQuery } from '../shared/exerciseSearch.js';

export const { searchExercises, searchExerciseList } = createExerciseSearch(Fuse);

// The same search as a plain browser script, for the server-rendered
// /workouts dashboard pages (served at /workouts/exercise-search.js): Fuse.js's
// UMD build (sets window.Fuse) + the shared module with its `export` keywords
// stripped, exposed as window.RepLabExerciseSearch. Built once, on first use.
let browserScript = null;
export function exerciseSearchBrowserScript() {
  if (browserScript) return browserScript;
  const require = createRequire(import.meta.url);
  const fuseDir = path.dirname(require.resolve('fuse.js'));
  const fuseUmd = fs.readFileSync(path.join(fuseDir, 'fuse.min.js'), 'utf8');
  const shared = fs.readFileSync(new URL('../shared/exerciseSearch.js', import.meta.url), 'utf8')
    .replace(/^export /gm, '');
  // Each part in its own function scope so neither leaks globals (the UMD
  // build declares `var e, t`) beyond window.Fuse / window.RepLabExerciseSearch.
  browserScript = '(function () {\n' + fuseUmd + '\n}).call(this);\n'
    + '(function () {\n' + shared
    + '\nwindow.RepLabExerciseSearch = createExerciseSearch(window.Fuse);\n})();\n';
  return browserScript;
}
