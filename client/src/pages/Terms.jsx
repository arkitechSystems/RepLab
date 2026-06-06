import { Link } from 'react-router-dom';

export default function Terms() {
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
            TERMS OF SERVICE
          </h1>
          <p className="text-[11px] uppercase text-white/40 mt-3 font-light" style={{ letterSpacing: '0.25em' }}>
            Last updated: May 12, 2026
          </p>
        </div>
      </div>

      <div className="space-y-4 text-sm text-wf-gray-300 leading-relaxed">
        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>1. Acceptance of Terms</h2>
            <div className="border-t border-white/5 pt-3">
              <p>REPLAB ("the App") is operated by <strong className="text-white">ArkiTech Systems, LLC</strong> ("we", "us", "our"). By accessing or using the App, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>2. Description of Service</h2>
            <div className="border-t border-white/5 pt-3">
              <p>REPLAB is a fitness tracking application that allows users to create workout programs, log exercises, track progress, and manage their fitness routine. The App is provided on an "as is" and "as available" basis.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>3. User Accounts</h2>
            <div className="border-t border-white/5 pt-3">
              <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating an account. You must be at least 13 years of age to use the App.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>4. Subscriptions and Payments</h2>
            <div className="border-t border-white/5 pt-3">
              <p>Some features of the App require a paid subscription. By purchasing a subscription, you agree to pay the applicable fees. Subscriptions automatically renew unless cancelled before the end of the current billing period. Refunds are handled in accordance with the policies of the platform through which you purchased the subscription.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>5. User Content</h2>
            <div className="border-t border-white/5 pt-3">
              <p>You retain ownership of any content you create within the App, including workout programs and exercise data. By using the App, you grant us a limited license to store and process your content solely to provide the service.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>6. Prohibited Conduct</h2>
            <div className="border-t border-white/5 pt-3">
              <p>You agree not to: (a) use the App for any unlawful purpose; (b) attempt to gain unauthorized access to the App or its systems; (c) interfere with or disrupt the App's functionality; (d) share your account credentials with others; or (e) use the App to distribute spam or malicious content.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>7. Health Disclaimer</h2>
            <div className="border-t border-white/5 pt-3">
              <p>The App is not a medical device and does not provide medical advice. Always consult a qualified healthcare professional before starting any exercise program. You use the App and follow any workout suggestions at your own risk. We are not liable for any injuries or health issues that may result from your use of the App.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>8. Limitation of Liability</h2>
            <div className="border-t border-white/5 pt-3">
              <p>To the maximum extent permitted by law, ArkiTech Systems, LLC and its members, officers, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the App. Our total liability shall not exceed the amount you paid for the App in the 12 months preceding the claim.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>9. Termination</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We reserve the right to suspend or terminate your account at any time for violation of these terms. You may delete your account at any time through the App's settings. Upon termination, your data may be deleted in accordance with our Privacy Policy.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>10. Governing Law</h2>
            <div className="border-t border-white/5 pt-3">
              <p>These Terms are governed by and construed in accordance with the laws of the State of Texas, United States, without regard to its conflict-of-law principles. The exclusive jurisdiction and venue for any dispute arising out of or related to these Terms or the App shall be the state and federal courts located in Texas, and you consent to the personal jurisdiction of those courts.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>11. Dispute Resolution</h2>
            <div className="border-t border-white/5 pt-3">
              <p>Before filing a claim, you agree to first contact us at <a href="mailto:support@replab-fitness.com" className="text-wf-red underline">support@replab-fitness.com</a> to attempt an informal resolution. If we cannot resolve the dispute within 30 days, either party may pursue the dispute in the courts identified in Section 10. Each party waives the right to a jury trial to the maximum extent permitted by law. You agree not to participate in a class action against us; all claims must be brought in your individual capacity.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>12. Changes to Terms</h2>
            <div className="border-t border-white/5 pt-3">
              <p>We may update these Terms of Service from time to time. We will notify users of material changes through the App. Your continued use of the App after changes constitutes acceptance of the updated terms.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>13. Contact</h2>
            <div className="border-t border-white/5 pt-3">
              <p>ArkiTech Systems, LLC<br />Email: <a href="mailto:support@replab-fitness.com" className="text-wf-red underline">support@replab-fitness.com</a></p>
              <p className="mt-2">For questions about these Terms of Service or to report a violation, contact us at the email above or through the App's in-product feedback feature.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <Link to="/privacy" className="text-wf-red text-sm font-medium">Privacy Policy</Link>
      </div>
    </div>
  );
}
