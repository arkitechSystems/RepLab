import { Link } from 'react-router-dom';

export default function Privacy() {
  const sectionPanelStyle = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 max-w-2xl mx-auto">
      <Link to="/" className="text-wf-gray-400 text-sm mb-6 inline-flex items-center gap-1 hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      <div className="relative overflow-hidden mb-6 mt-4" style={sectionPanelStyle}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative p-6">
          <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
            Legal
          </p>
          <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
            PRIVACY POLICY
          </h1>
          <p className="text-[11px] uppercase text-white/40 mt-3 font-light" style={{ letterSpacing: '0.25em' }}>
            Last updated: May 12, 2026
          </p>
        </div>
      </div>

      <div className="space-y-4 text-sm text-wf-gray-300 leading-relaxed">
        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>1. Information We Collect</h2>
            <div className="border-t border-white/5 pt-3">
              <p>REPLAB is operated by <strong className="text-white">ArkiTech Systems, LLC</strong>. We collect the following types of information:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Account Information:</strong> Email address, phone number (optional), username, first and last name, password (hashed, never stored in plaintext), and gender (optional) when you create an account.</li>
                <li><strong className="text-white">Fitness Data:</strong> Workout programs, exercise logs, weights, reps, sets, set types, cardio sessions, personal records, scheduled workouts, and notes that you enter into the App.</li>
                <li><strong className="text-white">Body Metrics (optional):</strong> Height, weight, body-fat percentage, and one-rep-max values you choose to record.</li>
                <li><strong className="text-white">Profile Information:</strong> Profile photo (optional) and display preferences.</li>
                <li><strong className="text-white">Approximate Location:</strong> ZIP code you enter during signup and city/state derived from your IP address at signup and login (used for analytics and abuse prevention; never precise GPS coordinates).</li>
                <li><strong className="text-white">Usage Data:</strong> Page views, feature interactions, session-replay recordings (see Section 8), error reports, device and browser identifiers, and login history. Used to improve the service and diagnose issues.</li>
                <li><strong className="text-white">Subscription Data:</strong> Stripe customer and subscription identifiers if you purchase a paid plan. We never see or store full payment card details.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>2. How We Use Your Information</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We use your information to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Provide, maintain, and improve the App's functionality</li>
                <li>Track your workout progress and personal records</li>
                <li>Sync your data across devices</li>
                <li>Process subscription payments</li>
                <li>Send important service-related communications</li>
                <li>Provide customer support</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>3. Data Storage and Security</h2>
            <div className="border-t border-white/5 pt-3">
              <p>Your data is stored on managed PostgreSQL infrastructure provided by Render in the United States. All traffic between your device and our servers is encrypted with TLS, and the database is encrypted at rest. Passwords are hashed with bcrypt and never stored in plaintext. While we take reasonable measures to protect your data, no method of electronic storage is 100% secure.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>4. Data Sharing</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We do not sell, rent, or trade your personal information. We share data only with the following categories of third-party processors who help us run the App and operate under contractual data-protection obligations:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Hosting and database:</strong> Render (US) hosts our web service and PostgreSQL database.</li>
                <li><strong className="text-white">Product analytics:</strong> PostHog (US Cloud) receives identified usage events and session-replay data tied to your user ID. See Section 8.</li>
                <li><strong className="text-white">Error monitoring:</strong> Sentry (US) receives anonymized error reports from the web and mobile apps. We disable Sentry's default PII collection (`sendDefaultPii: false`); reports include URL, browser/OS, and stack traces only.</li>
                <li><strong className="text-white">Payments:</strong> Stripe processes paid subscriptions. Stripe receives your email and payment method directly; we receive only the customer and subscription identifiers needed for billing.</li>
                <li><strong className="text-white">Transactional email:</strong> Resend (US) delivers account email such as password resets and order confirmations.</li>
                <li><strong className="text-white">Push notifications (mobile):</strong> Firebase Cloud Messaging (Google, US) routes push notifications to registered devices. We send the FCM device token plus the notification payload — no other personal data.</li>
                <li><strong className="text-white">AI workout generation:</strong> Anthropic Claude API (US) processes your training goals and equipment list to generate workout suggestions. We send the prompt you provide; Anthropic does not retain it for training per their commercial terms.</li>
                <li><strong className="text-white">IP-to-location lookup:</strong> ip-api.com is queried at signup and login to derive an approximate city/state from your IP address.</li>
                <li><strong className="text-white">Legal Requirements:</strong> We may disclose data when required by law or to protect our rights and safety.</li>
                <li><strong className="text-white">With Your Consent:</strong> Workout programs you explicitly choose to share with other REPLAB users are visible to those users.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>5. Your Rights</h2>
            <div className="border-t border-white/5 pt-3">
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Access and download your personal data</strong> — request a JSON export of every record we hold about you through the App's Profile settings (uses the <code className="text-white/80">/auth/export-data</code> endpoint).</li>
                <li><strong className="text-white">Correct inaccurate information</strong> — edit your profile, account details, and body metrics directly in the App.</li>
                <li><strong className="text-white">Delete your account and associated data</strong> — initiate from Profile → Delete Account inside the app, or visit <a href="https://replab-fitness.com/delete-account" className="text-wf-red underline">replab-fitness.com/delete-account</a> from any browser if you no longer have the app installed. Either path cascade-deletes your sessions, templates, programs, personal records, and metrics from our database.</li>
                <li><strong className="text-white">Opt out of non-essential communications</strong> — manage email preferences in Profile settings.</li>
              </ul>
              <p className="mt-2">To exercise any of these rights, use the account settings in the App or email us at <a href="mailto:support@replab-fitness.com" className="text-wf-red underline">support@replab-fitness.com</a>.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>6. Data Retention</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We retain your data for as long as your account is active. When you delete your account, your fitness data (workouts, programs, exercise logs, personal records, body metrics, scheduled sessions) is removed from our database immediately. Operational logs that contain only an account identifier — such as login history, password-reset audit records, and page-view analytics — may be retained for up to 90 days for security and abuse-detection purposes before being purged. Anonymized, aggregated metrics may be retained indefinitely for analytics.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>7. Children's Privacy</h2>
            <div className="border-t border-white/5 pt-3">
              <p>The App is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will take steps to delete that information.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>8. Cookies and Tracking</h2>
            <div className="border-t border-white/5 pt-3">
              <p>The App uses local storage and session tokens for authentication. We do not use third-party advertising trackers and we do not sell your data to advertisers.</p>
              <p className="mt-2"><strong className="text-white">Product analytics and session replay (PostHog):</strong> We use PostHog to understand how the App is used. After you sign in, PostHog associates events with your numeric user ID, email, and username (linked-to-identity). PostHog also captures session-replay recordings — visual reconstructions of your interactions with the App that may include the contents of pages you view (such as your displayed name, email, and workout data). Password fields are masked by default. Session-replay data is stored on PostHog's US infrastructure with a default 30-day retention.</p>
              <p className="mt-2"><strong className="text-white">Error monitoring (Sentry):</strong> Sentry receives anonymized error reports that include browser/OS, URL, and stack traces. We disable Sentry's optional PII collection.</p>
              <p className="mt-2"><strong className="text-white">No advertising trackers:</strong> The App does not load Facebook Pixel, Google Ads, TikTok Pixel, or similar advertising tracking scripts.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>9. Changes to This Policy</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We may update this Privacy Policy from time to time. We will notify you of material changes through the App. Your continued use of the App after changes constitutes acceptance of the updated policy.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>10. Contact</h2>
            <div className="border-t border-white/5 pt-3">
              <p>This Privacy Policy is published by:</p>
              <p className="mt-2">ArkiTech Systems, LLC<br />Email: <a href="mailto:support@replab-fitness.com" className="text-wf-red underline">support@replab-fitness.com</a></p>
              <p className="mt-2">For questions about this Privacy Policy, your data, or to exercise any of the rights described in Section 5, contact us at the email above or through the App's in-product feedback feature. We will respond within 30 days.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <Link to="/terms" className="text-wf-red text-sm font-medium">Terms of Service</Link>
      </div>
    </div>
  );
}
