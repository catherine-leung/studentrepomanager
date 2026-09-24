// app/page.tsx

"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { GitHubMark } from "@/components/ui/GitHubMark";
import { LogoMark } from "@/components/ui/Logo";
import { COPY } from "@/lib/copy";

function Spinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center
                 bg-canvas"
    >
      <div className="text-center" role="status">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-8 w-8 animate-spin
                     rounded-full border-2 border-primary-200
                     border-t-primary-600"
        />
        <p className="text-neutral-600">Loading…</p>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div
      className="relative hidden w-[42%] flex-col justify-between
                 overflow-hidden bg-gradient-to-br from-primary-700
                 via-primary-600 to-accent-600 px-10 py-12
                 text-white lg:flex"
    >
      {/* Decorative dot grid — pure CSS, no image request. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0
                   opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center
                     rounded-lg bg-white/15 ring-1 ring-white/25"
        >
          <LogoMark className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-semibold">
          {COPY.appName}
        </span>
      </div>

      <div className="relative">
        <h1 className="mb-6 text-3xl font-bold leading-tight">
          {COPY.login.subtitle}
        </h1>
        <ul className="space-y-4">
          {COPY.login.features.map((feature) => (
            <li key={feature.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center
                           justify-center rounded-md bg-white/15
                           text-base"
              >
                {feature.icon}
              </span>
              <div>
                <p className="font-medium">{feature.title}</p>
                <p className="text-sm text-white/75">
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-white/60">
        Built for professors distributing coursework on GitHub.
      </p>
    </div>
  );
}

function HomeContent() {
  const { status } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const rawCallbackUrl = params.get("callbackUrl") ?? "";
  const hasExplicitCallback =
    rawCallbackUrl.startsWith("/") &&
    !rawCallbackUrl.startsWith("//");
  const callbackUrl = hasExplicitCallback
    ? rawCallbackUrl
    : "/dashboard";

  // Whether the signed-in user owns at least one connected
  // organization (i.e. is a professor who has set one up).
  // Null while that's still unknown.
  const [ownsOrgs, setOwnsOrgs] = useState<boolean | null>(
    null
  );

  // Someone who arrived with an explicit destination (bounced
  // back here mid sign-in) always continues there. Someone who
  // lands on bare "/" only gets sent to the dashboard if they
  // actually own an organization -- otherwise they're very
  // likely a student who wandered here (e.g. via the redeem
  // page's "Go Home" button after a hiccup), and the
  // dashboard's "install the GitHub App" prompt is not meant
  // for them.
  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (hasExplicitCallback) {
      router.push(callbackUrl);
      return;
    }

    let cancelled = false;

    fetch("/api/orgs/installed")
      .then((r) => (r.ok ? r.json() : []))
      .then((orgs: unknown[]) => {
        if (cancelled) {
          return;
        }

        if (orgs.length > 0) {
          router.push("/dashboard");
        } else {
          setOwnsOrgs(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOwnsOrgs(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, hasExplicitCallback, callbackUrl, router]);

  if (status === "loading") {
    return <Spinner />;
  }

  // Authenticated with an explicit destination, or still
  // waiting to learn whether this account owns an org: a
  // redirect is imminent (or about to be decided), so avoid a
  // flash of unrelated content.
  if (
    status === "authenticated" &&
    (hasExplicitCallback || ownsOrgs === null)
  ) {
    return <Spinner />;
  }

  if (status === "authenticated" && ownsOrgs === false) {
    const copy = COPY.home.signedInNoOrg;

    return (
      <div className="flex min-h-screen items-center
                      justify-center bg-canvas px-4">
        <div className="w-full max-w-sm rounded-xl border
                        border-primary-100 bg-white p-8
                        text-center shadow-md">
          <h1 className="mb-2 text-xl font-bold
                        text-neutral-900">
            {copy.title}
          </h1>
          <p className="mb-4 text-sm text-neutral-600">
            {copy.message}
          </p>
          <p className="mb-6 text-sm text-neutral-600">
            {copy.studentNote}
          </p>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            {copy.dashboardButton}
          </Button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-4 text-sm font-medium
                       text-neutral-500 hover:text-neutral-700
                       focus-visible:outline-none
                       focus-visible:ring-2
                       focus-visible:ring-primary-500
                       focus-visible:ring-offset-2 rounded-sm"
          >
            {copy.signOutButton}
          </button>
        </div>
      </div>
    );
  }

  const handleSignIn = async () => {
    await signIn("github", { callbackUrl });
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#sign-in-card"
        className="sr-only focus:not-sr-only focus:absolute
                   focus:left-4 focus:top-4 focus:z-10
                   focus:rounded-md focus:bg-white
                   focus:px-4 focus:py-2 focus:text-sm
                   focus:font-medium focus:text-primary-700
                   focus:shadow-md"
      >
        Skip to sign in
      </a>

      <BrandPanel />

      <div className="flex flex-1 flex-col">
        <main className="flex flex-1 items-center justify-center
                         px-6 py-12">
          <div
            id="sign-in-card"
            className="w-full max-w-sm rounded-xl border
                       border-primary-100 bg-white p-8 shadow-md"
          >
            <h2
              className="mb-1 text-xl font-bold leading-snug
                         text-neutral-900"
            >
              {COPY.login.title}
            </h2>
            <p className="mb-6 text-sm text-neutral-600">
              Sign in with your GitHub account to continue.
            </p>

            <Button
              size="lg"
              variant="primary"
              onClick={handleSignIn}
              className="w-full bg-gradient-to-r from-primary-600
                         to-primary-700 hover:from-primary-700
                         hover:to-primary-800"
            >
              <GitHubMark />
              {COPY.login.signInButton}
            </Button>

            <p className="mt-4 text-center text-xs text-neutral-500">
              We only request the access needed to manage
              repositories on your behalf.
            </p>
          </div>
        </main>

        <footer className="border-t border-neutral-200">
          <div className="mx-auto max-w-6xl px-6 py-6">
            <div className="flex justify-center gap-8 text-sm">
              <a
                href="#"
                className="rounded-sm text-neutral-600
                           hover:text-neutral-900
                           focus-visible:outline-none
                           focus-visible:ring-2
                           focus-visible:ring-primary-500
                           focus-visible:ring-offset-2"
              >
                {COPY.login.footer.docs}
              </a>
              <a
                href="#"
                className="rounded-sm text-neutral-600
                           hover:text-neutral-900
                           focus-visible:outline-none
                           focus-visible:ring-2
                           focus-visible:ring-primary-500
                           focus-visible:ring-offset-2"
              >
                {COPY.login.footer.github}
              </a>
              <a
                href="#"
                className="rounded-sm text-neutral-600
                           hover:text-neutral-900
                           focus-visible:outline-none
                           focus-visible:ring-2
                           focus-visible:ring-primary-500
                           focus-visible:ring-offset-2"
              >
                {COPY.login.footer.support}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<Spinner />}>
      <HomeContent />
    </Suspense>
  );
}
