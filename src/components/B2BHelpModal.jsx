import React from "react";

export default function B2BHelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-neutral-700 bg-[#0a0a0a] p-6 text-white shadow-2xl sm:p-10">
        <button onClick={onClose} className="absolute right-6 top-6 text-2xl font-bold text-neutral-400 hover:text-white">&times;</button>
        
        <h2 className="mb-6 text-3xl font-semibold text-[#D4AF37]">B2B Sales System Guide</h2>
        
        <div className="space-y-8 text-sm leading-relaxed text-neutral-300">
          <section>
            <h3 className="mb-2 text-xl font-medium text-white">1. Lead Generation & Scoring</h3>
            <p className="mb-2">Prospects enter the system by filling out the Trade Application on the frontend (<code className="rounded bg-neutral-800 px-1 py-0.5">/trade</code>).</p>
            <ul className="mb-4 list-inside list-disc space-y-1 text-neutral-400">
              <li><strong>Automated Entry:</strong> The system automatically creates a B2B account and primary contact.</li>
              <li><strong>Lead Scoring:</strong> A score (0-100) is assigned based on business type, location, premium positioning, retail capabilities, and locations.</li>
            </ul>
            <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-[#D4AF37]">
              <strong>Tip:</strong> You can also bulk-import existing leads via the CSV import tab.
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xl font-medium text-white">2. Managing the Pipeline</h3>
            <p className="mb-2">Move accounts through these key stages to trigger the right automation:</p>
            <ul className="mb-4 list-inside list-disc space-y-1 text-neutral-400">
              <li><strong>new:</strong> Newly submitted applications.</li>
              <li><strong>qualified:</strong> You've reviewed the application and score.</li>
              <li><strong>approved_for_outreach:</strong> Ready for AI email/WhatsApp generation.</li>
              <li><strong>contacted:</strong> Initial outreach sent.</li>
              <li><strong>replied:</strong> Prospect responded (pauses automated follow-ups).</li>
              <li><strong>discovery_booked:</strong> Meeting scheduled.</li>
              <li><strong>sample_paid / sample_sent:</strong> Trialing the products.</li>
              <li><strong>proposal_sent:</strong> Opening order quote sent.</li>
              <li><strong>won:</strong> Opening order paid.</li>
              <li><strong>lost / nurture / suppressed:</strong> Unsuccessful or opted-out leads.</li>
            </ul>
            <p>Log all interactions under an account's <strong>Activities</strong> tab and create tasks to stay organized.</p>
          </section>

          <section>
            <h3 className="mb-2 text-xl font-medium text-white">3. AI-Powered Outreach</h3>
            <p className="mb-2">The system uses Google Gemini to generate personalized outreach drafts.</p>
            <ol className="mb-4 list-inside list-decimal space-y-1 text-neutral-400">
              <li>Click <strong>Draft email</strong> or <strong>Draft WhatsApp</strong> in the account view.</li>
              <li>The AI drafts a personalized message highlighting Advaya Care's benefits and opening order terms.</li>
              <li>Review the draft and click <strong>Approve</strong>.</li>
              <li>Dispatch emails directly, or open WhatsApp manually and click <strong>Confirm sent</strong>.</li>
            </ol>
            <div className="rounded-xl border border-blue-400/30 bg-blue-900/20 p-4 text-blue-200">
              <strong>Important:</strong> If a prospect replies, manually click <strong>Mark replied</strong>. This cancels pending automated follow-ups.
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xl font-medium text-white">4. Setting Trade Terms</h3>
            <p className="mb-2">Before quoting, configure wholesale terms in the <strong>Pricing</strong> tab.</p>
            <ul className="mb-4 list-inside list-disc space-y-1 text-neutral-400">
              <li>Set the <strong>Unit cost</strong>. The wholesale price is calculated to ensure a minimum 30% partner margin and 45% brand margin.</li>
              <li>Check <strong>Sample selected</strong> for up to 3 products to be used in the Sample Kit.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-xl font-medium text-white">5. Creating Quotes & Orders</h3>
            <p className="mb-2">Go to the <strong>Quotes</strong> tab and select an account. The system supports three quote types:</p>
            <ul className="mb-4 list-inside list-disc space-y-1 text-neutral-400">
              <li><strong>Sample Kit:</strong> Must contain exactly 3 unique selected sample products (1 unit each).</li>
              <li><strong>Opening Order:</strong> Requires a minimum subtotal of ₹12,000, 12 units total, and 2 units per selected SKU.</li>
              <li><strong>Reorder:</strong> Requires a minimum subtotal of ₹7,500 and 6 units.</li>
            </ul>
            <p className="mb-4">Once approved, send the <strong>Secure link</strong> to the prospect. They can review and pay directly.</p>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-900/20 p-4 text-emerald-200">
              <strong>Note:</strong> When a prospect pays for a Sample Kit, the system automatically creates a credit that will be applied to a qualifying opening order within 30 days!
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xl font-medium text-white">6. Suppressions and Opt-outs</h3>
            <p className="text-neutral-400">If a prospect asks not to be contacted, click <strong>Suppress</strong>. This automatically marks them as opted-out and cancels all pending outreach to ensure compliance.</p>
          </section>
        </div>
        
        <div className="mt-8 flex justify-end">
          <button onClick={onClose} className="rounded-full bg-neutral-100 px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-white">Close guide</button>
        </div>
      </div>
    </div>
  );
}
