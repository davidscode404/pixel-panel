import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 to-stone-800">
      <div className="container mx-auto px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-amber-400 hover:text-amber-300 mb-8 inline-block">
            ← Back to Home
          </Link>
          
          <h1 className="text-4xl font-bold text-amber-50 mb-8">Terms of Service</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-stone-300 mb-6">
              <strong>Last updated:</strong> {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">1. Acceptance of Terms</h2>
              <div className="text-stone-300 space-y-4">
                <p>By accessing and using PixelPanel AI Comics (&ldquo;the Service&rdquo;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">2. Description of Service</h2>
              <div className="text-stone-300 space-y-4">
                <p>PixelPanel is an AI-powered comic generation platform that allows users to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Create comic stories through voice input and text prompts</li>
                  <li>Generate AI-powered comic art and panels</li>
                  <li>Store and manage comic creations in the cloud</li>
                  <li>Collaborate and share comic content</li>
                  <li>Access premium AI features through subscription plans</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">3. User Accounts and Registration</h2>
              <div className="text-stone-300 space-y-4">
                <p>To access certain features, you must create an account. You agree to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate and complete registration information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized use</li>
                  <li>Be at least 13 years old to use our service</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">4. Acceptable Use Policy</h2>
              <div className="text-stone-300 space-y-4">
                <h3 className="text-xl font-medium text-amber-300">Prohibited Activities</h3>
                <p>You may not use our service to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Create content that is illegal, harmful, or violates rights</li>
                  <li>Generate hate speech, harassment, or discriminatory content</li>
                  <li>Create adult content without proper age verification</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>Attempt to reverse engineer or hack our systems</li>
                  <li>Use automated tools to access our service</li>
                  <li>Share account credentials with others</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">5. Intellectual Property Rights</h2>
              <div className="text-stone-300 space-y-4">
                <h3 className="text-xl font-medium text-amber-300">Your Content</h3>
                <p>You retain ownership of your original comic content. By using our service, you grant us a license to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Process and store your content to provide our service</li>
                  <li>Display your content as part of our service features</li>
                </ul>

                <h3 className="text-xl font-medium text-amber-300">Our Service</h3>
                <p>PixelPanel and its technology are protected by intellectual property laws. You may not:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Copy, modify, or distribute our software</li>
                  <li>Use our trademarks without permission</li>
                  <li>Reverse engineer our AI models</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">6. Payment Terms and Billing</h2>
              <div className="text-stone-300 space-y-4">
                <p>For premium subscriptions:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Fees are charged in advance on a recurring basis</li>
                  <li>All payments are processed securely through Stripe</li>
                  <li>Prices may change with 30 days notice</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">7. Refund and Dispute Policy</h2>
              <div className="text-stone-300 space-y-4">
                <p>PixelPanel AI Comics provides digital services only. Refunds are offered under the following circumstances:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Technical issues preventing service access for more than 48 hours</li>
                  <li>Duplicate payments made in error</li>
                  <li>Unauthorized charges to your account</li>
                  <li>Service discontinuation without notice</li>
                  <li>AI-generated content fails to meet quality standards after multiple attempts</li>
                </ul>

                <h3 className="text-xl font-medium text-amber-300">Refund Timeframes</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Monthly subscriptions: Refunds available within 7 days of initial purchase</li>
                  <li>Annual subscriptions: Refunds available within 30 days of initial purchase</li>
                  <li>No refunds for partial billing periods</li>
                </ul>

                <h3 className="text-xl font-medium text-amber-300">Dispute Resolution Process</h3>
                <p>If you have a dispute or complaint about our service:</p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Contact our support team at cfw.natalie@gmail.com</li>
                  <li>Provide detailed description of the issue</li>
                  <li>Include relevant account and transaction information</li>
                  <li>We will investigate and respond within 48 hours</li>
                  <li>We will work with you to reach a fair resolution</li>
                </ol>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">8. Cancellation Policy</h2>
              <div className="text-stone-300 space-y-4">
                <p>You may cancel your PixelPanel subscription at any time through the following methods:</p>
                
                <h3 className="text-xl font-medium text-amber-300">Self-Service Cancellation</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Log into your account and navigate to &ldquo;Account Settings&rdquo;</li>
                  <li>Select &ldquo;Subscription Management&rdquo;</li>
                  <li>Click &ldquo;Cancel Subscription&rdquo;</li>
                  <li>Follow the confirmation prompts</li>
                  <li>Receive email confirmation of cancellation</li>
                </ul>

                <h3 className="text-xl font-medium text-amber-300">Cancellation Effective Date</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Cancellation takes effect immediately upon confirmation</li>
                  <li>No additional charges will be made</li>
                  <li>Access continues until end of current billing period</li>
                  <li>Service features remain available until expiration</li>
                </ul>

                <h3 className="text-xl font-medium text-amber-300">Post-Cancellation Access</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Premium features available until subscription expires</li>
                  <li>Basic account features remain accessible</li>
                  <li>Comic generation limited to free tier</li>
                  <li>Cloud storage access maintained for 90 days</li>
                  <li>Previously generated comics remain accessible</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">9. Service Availability</h2>
              <div className="text-stone-300 space-y-4">
                <p>We strive to maintain high service availability but cannot guarantee uninterrupted access. We reserve the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Perform scheduled maintenance with advance notice</li>
                  <li>Modify or discontinue features</li>
                  <li>Suspend service for technical or legal reasons</li>
                  <li>Limit usage to prevent abuse</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">10. Privacy and Data Protection</h2>
              <div className="text-stone-300 space-y-4">
                <p>Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these terms by reference.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">11. Limitation of Liability</h2>
              <div className="text-stone-300 space-y-4">
                <p>To the maximum extent permitted by law:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Our service is provided &ldquo;as is&rdquo; without warranties</li>
                  <li>We are not liable for indirect or consequential damages</li>
                  <li>Our total liability is limited to amounts paid by you</li>
                  <li>AI-generated content may not always meet expectations</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">12. Termination</h2>
              <div className="text-stone-300 space-y-4">
                <p>Either party may terminate this agreement at any time:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>You may cancel your account through account settings</li>
                  <li>We may suspend or terminate accounts for violations</li>
                  <li>Upon termination, your access to the service will end</li>
                  <li>We may retain your data as required by law</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">13. Legal and Export Restrictions</h2>
              <div className="text-stone-300 space-y-4">
                <p>Use of our service is subject to applicable laws and regulations:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Service may not be available in all jurisdictions</li>
                  <li>Users must comply with local laws regarding AI-generated content</li>
                  <li>Export of our technology may be restricted by applicable laws</li>
                  <li>Users are responsible for ensuring compliance with their local regulations</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">14. Promotions and Offers</h2>
              <div className="text-stone-300 space-y-4">
                <p>Any promotions, discounts, or special offers are subject to the following terms:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Promotions may have limited time periods and usage restrictions</li>
                  <li>Cannot be combined with other offers unless explicitly stated</li>
                  <li>We reserve the right to modify or cancel promotions at any time</li>
                  <li>Promotional pricing applies only to new subscriptions unless specified</li>
                  <li>Free trial periods are subject to cancellation policies</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">15. Governing Law</h2>
              <div className="text-stone-300 space-y-4">
                <p>These terms are governed by the laws of the United States. Any disputes will be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">16. Contact Information</h2>
              <div className="text-stone-300 space-y-4">
                <p>For questions about these terms, contact us at:</p>
                <div className="bg-stone-800 p-4 rounded-lg">
                  <p><strong>Email:</strong> cfw.natalie@gmail.com</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-amber-400 mb-4">17. Changes to Terms</h2>
              <div className="text-stone-300">
                <p>We may update these terms from time to time. Material changes will be communicated via email or service notification. Continued use after changes constitutes acceptance of the updated terms.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
