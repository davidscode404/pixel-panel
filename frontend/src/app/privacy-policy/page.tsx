import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 to-stone-800">
      <div className="container mx-auto px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-amber-400 hover:text-amber-300 mb-8 inline-block">
            ← Back to Home
          </Link>
          
          <h1 className="text-4xl font-bold text-amber-50 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-stone-300 mb-6">
              <strong>Last updated:</strong> {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">1. Information We Collect</h2>
              <div className="text-stone-300 space-y-4">
                <h3 className="text-xl font-medium text-amber-300">Personal Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Email address and password for account creation</li>
                  <li>Voice recordings when using voice-to-comic features</li>
                  <li>Comic content and stories you create</li>
                  <li>Usage analytics and interaction data</li>
                </ul>

                <h3 className="text-xl font-medium text-amber-300">Technical Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>IP address and browser information</li>
                  <li>Device information and operating system</li>
                  <li>Cookies and similar tracking technologies</li>
                  <li>Log files and error reports</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">2. How We Use Your Information</h2>
              <div className="text-stone-300 space-y-4">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Generate AI-powered comic content based on your input</li>
                  <li>Provide and maintain our services</li>
                  <li>Process payments and manage subscriptions</li>
                  <li>Send important service notifications</li>
                  <li>Improve our AI models and user experience</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">3. Data Protection and Security</h2>
              <div className="text-stone-300 space-y-4">
                <p>We implement industry-standard security measures to protect your data:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>End-to-end encryption for all data transmission</li>
                  <li>Secure cloud storage with Supabase</li>
                  <li>Regular security audits and updates</li>
                  <li>PCI DSS compliance for payment processing</li>
                  <li>Limited access controls for our team</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">4. Data Sharing</h2>
              <div className="text-stone-300 space-y-4">
                <p>We do not sell your personal information. We may share data only in these circumstances:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>With your explicit consent</li>
                  <li>To comply with legal requirements</li>
                  <li>With trusted service providers (Supabase, Stripe, Google AI)</li>
                  <li>To protect our rights and prevent fraud</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">5. Your Rights</h2>
              <div className="text-stone-300 space-y-4">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Access your personal data</li>
                  <li>Correct inaccurate information</li>
                  <li>Delete your account and data</li>
                  <li>Export your comic creations</li>
                  <li>Opt-out of marketing communications</li>
                  <li>Withdraw consent for data processing</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">6. Cookies and Tracking</h2>
              <div className="text-stone-300 space-y-4">
                <p>We use cookies and similar technologies to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Remember your preferences and login status</li>
                  <li>Analyze usage patterns and improve our service</li>
                  <li>Provide personalized content recommendations</li>
                  <li>Ensure security and prevent fraud</li>
                </ul>
                <p>You can manage cookie preferences in your browser settings.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">7. Contact Us</h2>
              <div className="text-stone-300 space-y-4">
                <p>For privacy-related questions or requests, contact us at:</p>
                <div className="bg-stone-800 p-4 rounded-lg">
                  <p><strong>Email:</strong> cfw.natalie@gmail.com</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">8. Changes to This Policy</h2>
              <div className="text-stone-300">
                <p>We may update this privacy policy from time to time. We will notify you of any significant changes via email or through our service. Your continued use of PixelPanel after changes indicates acceptance of the updated policy.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
