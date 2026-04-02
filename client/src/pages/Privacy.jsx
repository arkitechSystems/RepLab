import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 max-w-2xl mx-auto">
      <Link to="/" className="text-wf-gray-400 text-sm mb-6 inline-flex items-center gap-1 hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      <h1 className="text-2xl font-bold mt-4 mb-6">Privacy Policy</h1>
      <p className="text-xs text-wf-gray-500 mb-6">Last updated: April 1, 2026</p>

      <div className="space-y-6 text-sm text-wf-gray-300 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-white mb-2">1. Information We Collect</h2>
          <p>We collect the following types of information:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong className="text-white">Account Information:</strong> Email address, name, and password (encrypted) when you create an account.</li>
            <li><strong className="text-white">Fitness Data:</strong> Workout programs, exercise logs, weights, reps, sets, and personal records that you enter into the App.</li>
            <li><strong className="text-white">Profile Information:</strong> Profile photo (optional) and display preferences.</li>
            <li><strong className="text-white">Usage Data:</strong> App usage patterns, feature interactions, and device information to improve the service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Provide, maintain, and improve the App's functionality</li>
            <li>Track your workout progress and personal records</li>
            <li>Sync your data across devices</li>
            <li>Process subscription payments</li>
            <li>Send important service-related communications</li>
            <li>Provide customer support</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">3. Data Storage and Security</h2>
          <p>Your data is stored on secure servers. We use industry-standard encryption for data in transit and at rest. Passwords are hashed and never stored in plain text. While we take reasonable measures to protect your data, no method of electronic storage is 100% secure.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">4. Data Sharing</h2>
          <p>We do not sell, rent, or trade your personal information to third parties. We may share data with:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong className="text-white">Service Providers:</strong> Hosting, payment processing, and infrastructure providers necessary to operate the App.</li>
            <li><strong className="text-white">Legal Requirements:</strong> When required by law or to protect our rights and safety.</li>
            <li><strong className="text-white">With Your Consent:</strong> Shared workout programs with other users when you explicitly choose to share.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Access and download your personal data</li>
            <li>Correct inaccurate information in your account</li>
            <li>Delete your account and associated data</li>
            <li>Opt out of non-essential communications</li>
          </ul>
          <p className="mt-2">To exercise these rights, use the account settings in the App or contact us directly.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">6. Data Retention</h2>
          <p>We retain your data for as long as your account is active. When you delete your account, your personal data is permanently removed from our servers within 30 days. Anonymized, aggregated data may be retained for analytics purposes.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">7. Children's Privacy</h2>
          <p>The App is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will take steps to delete that information.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">8. Cookies and Tracking</h2>
          <p>The App uses local storage and session tokens for authentication purposes. We do not use third-party advertising trackers. Analytics data is collected in aggregate form to improve the App's performance and features.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of material changes through the App. Your continued use of the App after changes constitutes acceptance of the updated policy.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">10. Contact</h2>
          <p>If you have questions about this Privacy Policy or your data, please contact us through the App's feedback feature or at the email address provided in the App.</p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <Link to="/terms" className="text-wf-red text-sm font-medium">Terms of Service</Link>
      </div>
    </div>
  );
}
