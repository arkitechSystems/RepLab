# Email image hosting

Files in this folder are served at `https://replab-fitness.com/email-img/<filename>`
and referenced from the welcome / transactional email HTML templates.

## Expected files

| File | Used in | Suggested dimensions |
|---|---|---|
| `plate-calc.png` | Welcome email — "Plate Calculator — In Your Workout" section | 600×900px or 2x retina (~1200×1800px). PNG with transparent or solid background. |
| `workout-session.png` | Welcome email — "Track Your Lifts" section | Same as above. |

## How to add a new image

1. Take the screenshot from the app (real device or browser at iPhone width). Crop tight.
2. Optimize: under 300 KB ideal, under 800 KB acceptable. Use tinypng.com or similar.
3. Drop the file in this directory using the name expected by the email template.
4. Commit and push — Render serves `client/public/` as static assets, no rebuild needed for the file alone (the URL is stable).
5. Send yourself a test welcome email to confirm the image loads:
   `node --env-file=server/.env server/scripts/send-welcome-test.js <your-email>`

## If an image is missing

The `<img>` tag in the email has descriptive `alt` text. Most email clients
(Gmail, Apple Mail, Outlook) show the alt text + a broken-image icon when
the URL 404s. Users won't see a fatal-looking error; just an obvious gap.
Fill in any missing file ASAP after deploying.
