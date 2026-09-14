// app/page.tsx

"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { COPY } from "@/lib/copy";

function HomeContent() {
  const { status } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const rawCallbackUrl = params.get("callbackUrl") ?? "";
  const callbackUrl =
    rawCallbackUrl.startsWith("/") &&
    !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/dashboard";

  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  const handleSignIn = async () => {
    await signIn("github", { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br
                    from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            {COPY.login.title}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {COPY.login.subtitle}
          </p>

          <button
            onClick={handleSignIn}
            className="inline-flex items-center gap-2 bg-black
                       text-white px-8 py-4 rounded-lg
                       hover:bg-gray-800 transition font-medium
                       text-lg"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.603-3.369-1.343-3.369-1.343-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.544 2.914 1.19.092-.926.35-1.557.636-1.914-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.817c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.195 20 14.44 20 10.017 20 4.484 15.522 0 10 0z"
                clipRule="evenodd"
              />
            </svg>
            {COPY.login.signInButton}
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {COPY.login.features.map((feature, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-md p-8
                         hover:shadow-lg transition"
            >
              <div className="text-4xl mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex justify-center gap-8 text-sm">
            <a
              href="#"
              className="text-gray-600 hover:text-gray-900"
            >
              {COPY.login.footer.docs}
            </a>
            <a
              href="#"
              className="text-gray-600 hover:text-gray-900"
            >
              {COPY.login.footer.github}
            </a>
            <a
              href="#"
              className="text-gray-600 hover:text-gray-900"
            >
              {COPY.login.footer.support}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
