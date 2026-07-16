import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl.slice(0, -4) : envUrl;
  }
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  // Include cookies cross-origin (port 5173 → 5000)
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
          type: "string",
          required: false,
        },
      },
    }),
  ],
});

export default authClient;
