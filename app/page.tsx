"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function HomeContent() {
  const { status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

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
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Student Repo Manager
        </h1>

        <p className="text-gray-600 mb-8">
          Manage your classroom repositories
        </p>

        <button
          onClick={handleSignIn}
          className={
            "bg-black text-white px-6 py-3 rounded-lg " +
            "hover:bg-gray-800 transition"
          }
        >
          Sign in with GitHub
        </button>
      </div>
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
