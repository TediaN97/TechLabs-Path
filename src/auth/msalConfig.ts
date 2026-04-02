import type { Configuration } from "@azure/msal-browser";
import { LogLevel } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID ?? "";
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID ?? "";
const redirectUri =
  import.meta.env.VITE_ENTRA_REDIRECT_URI ?? window.location.origin;

const POST_LOGOUT_REDIRECT =
  "http://localhost:5173/";

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: POST_LOGOUT_REDIRECT,
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};

/** True when the minimum required auth config is present. */
export const isAuthConfigValid = clientId.length > 0 && tenantId.length > 0;
