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
            Last updated: April 1, 2026
          </p>
        </div>
      </div>

      <div className="space-y-4 text-sm text-wf-gray-300 leading-relaxed">
        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>1. Information We Collect</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We collect the following types of information:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Account Information:</strong> Email address, name, and password (encrypted) when you create an account.</li>
                <li><strong className="text-white">Fitness Data:</strong> Workout programs, exercise logs, weights, reps, sets, and personal records that you enter into the App.</li>
                <li><strong className="text-white">Profile Information:</strong> Profile photo (optional) and display preferences.</li>
                <li><strong className="text-white">Usage Data:</strong> App usage patterns, feature interactions, and device information to improve the service.</li>
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
              <p>Your data is stored on secure servers. We use industry-standard encryption for data in transit and at rest. Passwords are hashed and never stored in plain text. While we take reasonable measures to protect your data, no method of electronic storage is 100% secure.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>4. Data Sharing</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We do not sell, rent, or trade your personal information to third parties. We may share data with:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Service Providers:</strong> Hosting, payment processing, and infrastructure providers necessary to operate the App.</li>
                <li><strong className="text-white">Legal Requirements:</strong> When required by law or to protect our rights and safety.</li>
                <li><strong className="text-white">With Your Consent:</strong> Shared workout programs with other users when you explicitly choose to share.</li>
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
                <li>Access and download your personal data</li>
                <li>Correct inaccurate information in your account</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of non-essential communications</li>
              </ul>
              <p className="mt-2">To exercise these rights, use the account settings in the App or contact us directly.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>6. Data Retention</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We retain your data for as long as your account is active. When you delete your account, your personal data is permanently removed from our servers immediately. Anonymized, aggregated data may be retained for analytics purposes.</p>
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
              <p>The App uses local storage and session tokens for authentication purposes. We do not use third-party advertising trackers. Analytics data is collected in aggregate form to improve the App's performance and features.</p>
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
              <p>If you have questions about this Privacy Policy or your data, please contact us through the App's feedback feature or at the email address provided in the App.</p>
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
