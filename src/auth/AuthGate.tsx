import {
  useMsal,
  useIsAuthenticated,
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useState } from "react";
import { loginRequest, isAuthConfigValid } from "./msalConfig";

function MicrosoftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function ConfigError() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-5">
        <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-red-500"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-800">Configuration Missing</h2>
          <p className="text-sm text-gray-500 mt-1">
            Microsoft Entra configuration is missing. Set{" "}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">
              VITE_ENTRA_CLIENT_ID
            </code>{" "}
            and{" "}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">
              VITE_ENTRA_TENANT_ID
            </code>{" "}
            in your <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">.env</code> file.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginScreen() {
  const { instance, inProgress } = useMsal();
  const [error, setError] = useState<string | null>(null);

  const isInteracting = inProgress !== InteractionStatus.None;

  if (!isAuthConfigValid) {
    return <ConfigError />;
  }

  async function handleLogin() {
    setError(null);
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign-in failed. Please try again."
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-5">
        <div className="h-14 w-14 rounded-full bg-[#6556d2]/10 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-[#6556d2]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-800">TechPath Labs</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sign in with Microsoft to continue
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-500 font-medium text-center">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={isInteracting}
          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#6556d2] rounded-lg hover:bg-[#5445b5] active:bg-[#4a3a9e] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
        >
          {isInteracting ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
              Signing in…
            </>
          ) : (
            <>
              <MicrosoftIcon />
              Sign in with Microsoft
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="h-8 w-8 animate-spin text-[#6556d2]"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-75"
          />
        </svg>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  );
}

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // While MSAL is handling a redirect or initializing, show loading
  if (
    inProgress === InteractionStatus.HandleRedirect ||
    inProgress === InteractionStatus.Startup
  ) {
    return <LoadingScreen />;
  }

  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        {isAuthenticated ? <LoadingScreen /> : <LoginScreen />}
      </UnauthenticatedTemplate>
    </>
  );
}
