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

const msalInstance = new PublicClientApplication(msalConfig);

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </StrictMode>
);
