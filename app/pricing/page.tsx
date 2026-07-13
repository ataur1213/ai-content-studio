"use client";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-4xl font-bold text-center">
          Pricing Plans
        </h1>

        <p className="text-center text-gray-500 mt-2">
          Choose the plan that fits your needs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold">Free</h2>

            <p className="text-5xl font-bold mt-6">$0</p>

            <ul className="mt-8 space-y-3 text-gray-600">
              <li>✅ Image Generator</li>
              <li>✅ Script Writer</li>
              <li>✅ Prompt Enhancer</li>
              <li>❌ Video Generator</li>
              <li>❌ Voice Generator</li>
            </ul>

            <button className="w-full mt-8 bg-blue-600 text-white py-3 rounded-xl">
              Current Plan
            </button>
          </div>

          <div className="bg-blue-600 text-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold">Pro</h2>

            <p className="text-5xl font-bold mt-6">$9</p>

            <ul className="mt-8 space-y-3">
              <li>✅ Unlimited Images</li>
              <li>✅ AI Video</li>
              <li>✅ AI Voice</li>
              <li>✅ Automation</li>
              <li>✅ Priority Speed</li>
            </ul>

            <button className="w-full mt-8 bg-white text-blue-600 py-3 rounded-xl font-bold">
              Upgrade
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold">Business</h2>

            <p className="text-5xl font-bold mt-6">$29</p>

            <ul className="mt-8 space-y-3 text-gray-600">
              <li>✅ Everything in Pro</li>
              <li>✅ Team Members</li>
              <li>✅ API Access</li>
              <li>✅ White Label</li>
              <li>✅ Premium Support</li>
            </ul>

            <button className="w-full mt-8 bg-black text-white py-3 rounded-xl">
              Contact Sales
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}