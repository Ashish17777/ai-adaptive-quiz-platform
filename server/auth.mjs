import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";

export const auth = betterAuth({
  database: mongodbAdapter(mongoose.connection.db, {
    transaction: false,
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  // Trust all localhost and dev server origins
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:5000",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/callback/google`,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "student",
      },
      currentStreak: {
        type: "number",
        defaultValue: 0,
      },
      longestStreak: {
        type: "number",
        defaultValue: 0,
      },
      lastActiveDate: {
        type: "date",
        required: false,
      },
    },
  },
});
