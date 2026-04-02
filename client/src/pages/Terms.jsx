import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 max-w-2xl mx-auto">
      <Link to="/" className="text-wf-gray-400 text-sm mb-6 inline-flex items-center gap-1 hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      <h1 className="text-2xl font-bold mt-4 mb-6">Terms of Service</h1>
      <p className="text-xs text-wf-gray-500 mb-6">Last updated: April 1, 2026</p>

      <div className="space-y-6 text-sm text-wf-gray-300 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-white mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using RepLab ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">2. Description of Service</h2>
          <p>RepLab is a fitness tracking application that allows users to create workout programs, log exercises, track progress, and manage their fitness routine. The App is provided on an "as is" and "as available" basis.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">3. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating an account. You must be at least 13 years of age to use the App.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">4. Subscriptions and Payments</h2>
          <p>Some features of the App require a paid subscription. By purchasing a subscription, you agree to pay the applicable fees. Subscriptions automatically renew unless cancelled before the end of the current billing period. Refunds are handled in accordance with the policies of the platform through which you purchased the subscription (Apple App Store, Google Play Store, or web).</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">5. User Content</h2>
          <p>You retain ownership of any content you create within the App, including workout programs and exercise data. By using the App, you grant us a limited license to store and process your content solely to provide the service.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">6. Prohibited Conduct</h2>
          <p>You agree not to: (a) use the App for any unlawful purpose; (b) attempt to gain unauthorized access to the App or its systems; (c) interfere with or disrupt the App's functionality; (d) share your account credentials with others; or (e) use the App to distribute spam or malicious content.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">7. Health Disclaimer</h2>
          <p>The App is not a medical device and does not provide medical advice. Always consult a qualified healthcare professional before starting any exercise program. You use the App and follow any workout suggestions at your own risk. We are not liable for any injuries or health issues that may result from your use of the App.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">8. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, RepLab and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the App. Our total liability shall not exceed the amount you paid for the App in the 12 months preceding the claim.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">9. Termination</h2>
          <p>We reserve the right to suspend or terminate your account at any time for violation of these terms. You may delete your account at any time through the App's settings. Upon termination, your data may be deleted in accordance with our Privacy Policy.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">10. Changes to Terms</h2>
          <p>We may update these Terms of Service from time to time. We will notify users of material changes through the App. Your continued use of the App after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">11. Contact</h2>
          <p>If you have questions about these Terms of Service, please contact us through the App's feedback feature or at the email address provided in the App.</p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <Link to="/privacy" className="text-wf-red text-sm font-medium">Privacy Policy</Link>
      </div>
    </div>
  );
}
