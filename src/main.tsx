import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  PublicClientApplication,
  EventType,
  type AuthenticationResult,
} from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./auth/msalConfig";
import "./index.css";
import App from "./App.tsx";

const root = createRoot(document.getElementById("root")!);

/**
 * Initialise MSAL, then render the app.
 *
 * If MSAL fails to initialise (e.g. corrupt localStorage cache from a
 * previous session), clear the problematic keys and retry once.
 * This prevents the "white screen" that previously required manual
 * cookie / localStorage clearing.
 */
async function boot(retried = false): Promise<void> {
  try {
    const msalInstance = new PublicClientApplication(msalConfig);

    // MSAL v5 requires explicit initialization before any API calls
    await msalInstance.initialize();

    // Handle redirect promise (resolves login redirect flow)
    const response = await msalInstance.handleRedirectPromise();
    if (response?.account) {
      msalInstance.setActiveAccount(response.account);
    }

    // Set active account after redirect login
    msalInstance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS &&
        (event.payload as AuthenticationResult)?.account
      ) {
        msalInstance.setActiveAccount(
          (event.payload as AuthenticationResult).account
        );
      }
    });

    // If there are already accounts cached, set the first one as active
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
      msalInstance.setActiveAccount(accounts[0]);
    }

    root.render(
      <StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </StrictMode>
    );
  } catch (err) {
    console.error("[Boot] MSAL initialization failed:", err);

    if (!retried) {
      console.warn("[Boot] Clearing MSAL cache and retrying…");
      clearMsalCache();
      return boot(true);
    }

    // Even after retry, render the app so the user isn't stuck on white screen
    console.error("[Boot] Retry also failed — rendering app without MSAL");
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}

/**
 * Remove MSAL-related keys from localStorage.
 * MSAL v5 stores its cache under keys that start with specific prefixes.
 */
function clearMsalCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith("msal.") ||
        key.startsWith("login.") ||
        key.includes(".login.") ||
        key.includes("accesstoken") ||
        key.includes("idtoken") ||
        key.includes("refreshtoken") ||
        key.includes("account") ||
        key.includes("authority"))
    ) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  console.info(`[Boot] Cleared ${keysToRemove.length} MSAL cache key(s)`);
}

boot();
