# Launch Copy Punch List — generated 2026-05-01

Audit scope: `client/src/pages/Terms.jsx`, `client/src/pages/Privacy.jsx`, `_marketing/app-store-metadata.md`, `_marketing/privacy-nutrition-answers.md`. Cross-referenced against `client/package.json` installed SDKs.

Total placeholder / missing-value items found: **24** (10 CRITICAL, 8 SHOULD-FIX, 6 DECISIONS).

---

## CRITICAL (blocks submission)

- [ ] **Terms.jsx §11 Contact:** No real contact email is given — copy reads "the email address provided in the App." Apple and Google both require a verifiable support contact directly in the Terms. Hard-code `support@replab-fitness.com` (or whichever mailbox is live in Resend) and link it.
- [ ] **Privacy.jsx §10 Contact:** Same problem — no email, no postal address, no entity name. GDPR/CCPA jurisdictions expect at minimum a real email; Apple App Privacy section also wants a privacy contact. Add `support@replab-fitness.com` (or `privacy@replab-fitness.com`) explicitly.
- [ ] **Terms.jsx:** Missing **Governing Law / Jurisdiction** clause entirely. This is standard SaaS boilerplate and reviewers (especially Apple legal) flag its absence. Need LLC's state of formation to draft this.
- [ ] **Terms.jsx:** Missing **Dispute Resolution / Arbitration** clause. Optional but strongly recommended; without it, all disputes default to court litigation. Decide: arbitration + class-action waiver, or omit.
- [ ] **Terms.jsx + Privacy.jsx:** Neither document names the legal entity offering the service ("RepLab and its creators" is the only phrasing — see Terms §8). Apple's Paid Apps Agreement requires the operating legal entity to be identifiable in user-facing terms. Need real LLC name (e.g., "ArkiTech Systems LLC" — the Sentry org slug is `arkitech-systems-llc`, confirm whether that's the launch entity).
- [ ] **Privacy.jsx §1 Information We Collect:** Does not disclose **phone number** (mentioned in `replab_user` localStorage payload), **zip code / IP-derived location** (declared in privacy-nutrition-answers.md as Location data), or **gender** (declared in "Other Data"). Apple and Google both require parity between the Nutrition Label / Data Safety form and the public privacy policy. Mismatch = rejection risk.
- [ ] **Privacy.jsx §4 Data Sharing:** Does not name any third-party processors. Privacy-nutrition-answers.md lists PostHog, Sentry, Stripe, Resend, Firebase Cloud Messaging, Anthropic Claude API, and ip-api.com. **None** are disclosed in Privacy.jsx. GDPR-style policies require sub-processor disclosure, and Apple specifically asks the policy to reflect the Nutrition Label.
- [ ] **Privacy.jsx §8 Cookies and Tracking:** States "Analytics data is collected in aggregate form" — this directly contradicts the audit, which documents PostHog **session replay linked to `user_id`** plus identified custom events. Per `privacy-nutrition-answers.md` TODO 1a, session replay captures emails, names, and other free-text rendered in the UI. This must be disclosed explicitly or replay must be disabled / masked before launch.
- [ ] **Privacy.jsx §6 Data Retention:** Says "your personal data is permanently removed from our servers immediately" — but `privacy-nutrition-answers.md` TODO 4 notes that `user_login_history`, `password_reset_log`, and `page_visits` grow forever, and the cascade-delete claim should be verified (TODO 9 — staging smoke test pending). Either implement auto-purge or soften the language to match actual behavior. Misrepresenting deletion is an FTC issue.
- [ ] **app-store-metadata.md:** Missing **Copyright** field (App Store Connect required). Standard format: `© 2026 <LLC NAME>`. Cannot fill until LLC name is finalized.

## SHOULD FIX (low-effort polish)

- [ ] **Terms.jsx + Privacy.jsx "Last updated: April 1, 2026":** Bump to actual finalized date before submission (today is 2026-05-01). Currently a month stale.
- [ ] **Privacy.jsx §3 Data Storage and Security:** Add concrete location ("hosted on Render in US-East") — Apple/Google data-safety forms ask where data is stored; users sometimes look here for that answer.
- [ ] **Privacy.jsx §7 Children's Privacy:** Aligns with Terms §3 (13+) — good. But Terms.jsx §3 just says "at least 13 years of age" with no COPPA-compliance language. Privacy-nutrition-answers.md TODO 5 notes "code has no under-13 gating" — add a signup-side birthday check or accept the policy-only gating.
- [ ] **Privacy.jsx §5 Your Rights:** Mention the data-export endpoint by name ("download a JSON export from your account settings" — backed by `GET /auth/export-data`). Currently vague.
- [ ] **Privacy.jsx:** Add an explicit **California (CCPA/CPRA) rights** subsection and an **EU/UK (GDPR) rights** subsection if you plan to accept users from those regions. Generic "Your Rights" §5 is not jurisdiction-specific and reviewers in those markets sometimes flag this.
- [ ] **app-store-metadata.md:** No declared **Apple Developer / Team name** value for the listing footer. Cannot finalize until Apple Dev account is provisioned (LLC blocker per `MEMORY.md`).
- [ ] **app-store-metadata.md:** TODO #6 in that file flags `FreeTrialOffer.jsx` was never read for trial-terms language. If a trial exists, App Store Connect's "Auto-renewable subscription" form requires trial terms in the description per Apple §3.1.2. Confirm or remove.
- [ ] **privacy-nutrition-answers.md TODO 1a:** PostHog session replay disclosure / masking is still open. Either (i) add the explicit replay paragraph to Privacy.jsx §8, or (ii) configure `session_recording: { maskAllInputs: true }` in PostHog and update the doc.

## DECISIONS USER NEEDS TO MAKE

- [ ] **LLC legal name** — needed for Terms entity reference, Privacy entity reference, App Store copyright string, App Store Connect organization name. Blocked by LLC formation per `MEMORY.md` (`project_llc_duns_blocker.md`).
- [ ] **LLC state of formation** — needed for governing-law clause in Terms.jsx.
- [ ] **Support email mailbox** — currently the metadata uses `https://replab-fitness.com/support` (a URL, not an email). Pick a real mailbox (`support@replab-fitness.com`?) and confirm it's live in Resend. Note `project_resend_pending.md` flags an open Resend issue.
- [ ] **Dispute resolution model** — arbitration + class-action waiver, or court litigation only? Adds a section to Terms.jsx.
- [ ] **PostHog session replay** — keep on with disclosure, or turn off / mask before launch? Affects Privacy.jsx §8 wording and the nutrition label "Usage Data" purpose string.
- [ ] **App Store keywords swap** — `app-store-metadata.md` offers swapping `coach` → `tracker` (99 chars) or `PRs` → `progress` (101, would need trim). Pick one or leave as-is.

## ALREADY GOOD (no changes needed)

- App Store description draft (`_marketing/app-store-metadata.md`) reads cleanly, is well under the 4000-char limit (~1,930), respects iOS guideline 3.1.1 (no in-app purchase wording), and uses the correct REPLAB all-caps brand spelling consistently. No `[TODO]` placeholders in the description body itself.
- App Store / Play app name, subtitle, promo text variants, keywords, and short description are all length-checked and verified within limits.
- Age-rating questionnaire is fully answered (all "None" → 4+).
- Privacy Nutrition Label table (`_marketing/privacy-nutrition-answers.md` §1) is complete; every Apple category has Collected/Linked/Tracking/Purpose values. Same for the Play Data Safety table (§2).
- Sentry is fully disclosed in `privacy-nutrition-answers.md` (frontend `@sentry/react` v10.47.0 + backend `@sentry/node` v10.47.0, `sendDefaultPii: false`, source-map upload via `@sentry/vite-plugin`). Matches `client/package.json`.
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (v6/v10/v3) are pure drag-and-drop UI libraries — no data collection, no disclosure needed.
- `@capacitor-firebase` is **NOT** installed. Push notifications use `@capacitor/push-notifications` and the server's `FCM_SERVICE_ACCOUNT_JSON`; no client-side Firebase SDK to disclose. `privacy-nutrition-answers.md` correctly handles this.
- PostHog (`posthog-js` v1.369.4) is disclosed in `privacy-nutrition-answers.md` including the session-replay caveat — the disclosure copy itself is thorough; the gap is only in Privacy.jsx, flagged above.
- No "WillFit" string in either Terms.jsx or Privacy.jsx. (One stale reference exists in `client/src/pages/Workouts.jsx` but that's outside this audit scope.)
- Terms.jsx §7 (Health Disclaimer) is present and clear — Apple typically wants to see this for fitness apps and it's there.
- Terms.jsx §4 (Subscriptions and Payments) correctly defers refunds to the platform store policies — App Store-safe wording.
