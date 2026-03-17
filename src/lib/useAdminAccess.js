import React from "react";
import {
  getAdminEmail,
  sendAdminOtpCode,
  verifyAdminOtpCode,
  signOutAdmin,
} from "./adminOrdersApi";
import { adminSupabase } from "./adminSupabaseClient";

const NETWORK_ERROR_MESSAGE = "Network interrupted. Check your internet connection and retry.";

function decodeJwtPayload(accessToken) {
  const token = String(accessToken || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function hasValidAdminTokenShape(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return false;

  const iss = String(payload?.iss || "").trim().toLowerCase();
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim().toLowerCase();
  if (!supabaseUrl) return true;

  return iss.includes(`${supabaseUrl}/auth/v1`);
}

function decodeJwtExpiryEpochSeconds(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const payloadText = atob(padded);
    const payload = JSON.parse(payloadText);
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

function isNetworkError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("err_") ||
    message.includes("name not resolved") ||
    message.includes("internet disconnected")
  );
}

export function useAdminAccess() {
  const adminEmail = getAdminEmail();
  const [checkingAccess, setCheckingAccess] = React.useState(true);
  const [authorized, setAuthorized] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [signedInEmail, setSignedInEmail] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpCooldownUntil, setOtpCooldownUntil] = React.useState(0);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");

  const clearLocalSession = React.useCallback(async () => {
    await adminSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }, []);

  const resolveAdminSession = React.useCallback(async () => {
    const {
      data: { session },
    } = await adminSupabase.auth.getSession();

    const initialSessionEmail = String(session?.user?.email || "").trim().toLowerCase();
    const hasAccessToken = Boolean(String(session?.access_token || "").trim());
    const hasRefreshToken = Boolean(String(session?.refresh_token || "").trim());

    if (hasAccessToken && !hasValidAdminTokenShape(session?.access_token)) {
      await clearLocalSession();
      return { email: "", authorized: false, expired: true };
    }

    let sessionEmail = initialSessionEmail;

    if (!sessionEmail && hasAccessToken && hasRefreshToken) {
      let user = null;
      try {
        ({ data: { user } } = await adminSupabase.auth.getUser());
      } catch (userFetchError) {
        if (isNetworkError(userFetchError)) {
          throw new Error(NETWORK_ERROR_MESSAGE);
        }
        throw userFetchError;
      }

      sessionEmail = String(user?.email || "").trim().toLowerCase();
    }

    if (!sessionEmail) {
      if (hasAccessToken && !hasRefreshToken) {
        await clearLocalSession();
        return { email: "", authorized: false, expired: true };
      }

      return { email: "", authorized: false, expired: false };
    }

    let verifiedUser = null;
    let verifyError = null;

    try {
      const { data, error } = await adminSupabase.auth.getUser(session.access_token);
      verifiedUser = data?.user || null;
      verifyError = error;
    } catch (verifyException) {
      if (isNetworkError(verifyException)) {
        throw new Error(NETWORK_ERROR_MESSAGE);
      }
      throw verifyException;
    }

    if (!verifyError && verifiedUser?.email) {
      const verifiedEmail = String(verifiedUser.email).trim().toLowerCase();
      sessionEmail = verifiedEmail;
    } else if (hasRefreshToken) {
      let refreshedData = null;
      let refreshError = null;

      try {
        const { data, error } = await adminSupabase.auth.refreshSession();
        refreshedData = data;
        refreshError = error;
      } catch (refreshException) {
        if (isNetworkError(refreshException)) {
          throw new Error(NETWORK_ERROR_MESSAGE);
        }
        throw refreshException;
      }

      if (refreshError || !refreshedData?.session?.access_token) {
        if (isNetworkError(refreshError)) {
          throw new Error(NETWORK_ERROR_MESSAGE);
        }
        await clearLocalSession();
        return { email: "", authorized: false, expired: true };
      }

      let refreshedUser = null;
      let refreshedVerifyError = null;

      try {
        const { data, error } = await adminSupabase.auth.getUser(refreshedData.session.access_token);
        refreshedUser = data?.user || null;
        refreshedVerifyError = error;
      } catch (refreshedVerifyException) {
        if (isNetworkError(refreshedVerifyException)) {
          throw new Error(NETWORK_ERROR_MESSAGE);
        }
        throw refreshedVerifyException;
      }

      if (refreshedVerifyError || !refreshedUser?.email) {
        await clearLocalSession();
        return { email: "", authorized: false, expired: true };
      }

      sessionEmail = String(refreshedUser.email).trim().toLowerCase();
    } else {
      await clearLocalSession();
      return { email: "", authorized: false, expired: true };
    }

    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    const sessionExpiry = Number(session?.expires_at);
    const tokenExpiry = decodeJwtExpiryEpochSeconds(session?.access_token);
    const effectiveExpiry = Number.isFinite(sessionExpiry) ? sessionExpiry : tokenExpiry;
    const isTokenFresh =
      Boolean(session?.access_token) &&
      Number.isFinite(effectiveExpiry) && effectiveExpiry - 30 > nowEpochSeconds;

    if (isTokenFresh) {
      return { email: sessionEmail, authorized: sessionEmail === adminEmail, expired: false };
    }

    if (!hasRefreshToken) {
      await clearLocalSession();
      return { email: "", authorized: false, expired: true };
    }

    let refreshData = null;
    let refreshError = null;

    try {
      const { data, error } = await adminSupabase.auth.refreshSession();
      refreshData = data;
      refreshError = error;
    } catch (refreshException) {
      if (isNetworkError(refreshException)) {
        throw new Error(NETWORK_ERROR_MESSAGE);
      }
      throw refreshException;
    }

    if (refreshError || !refreshData?.session?.access_token) {
      if (isNetworkError(refreshError)) {
        throw new Error(NETWORK_ERROR_MESSAGE);
      }
      await clearLocalSession();
      return { email: "", authorized: false, expired: true };
    }

    const refreshedEmail = String(refreshData.session.user?.email || "").trim().toLowerCase();
    return {
      email: refreshedEmail,
      authorized: refreshedEmail === adminEmail,
      expired: false,
    };
  }, [adminEmail, clearLocalSession]);

  const refreshAccess = React.useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setCheckingAccess(true);
      }
      setError("");

      try {
        const snapshot = await resolveAdminSession();
        setSignedInEmail(snapshot.email);
        setAuthorized(snapshot.authorized);

        if (snapshot.expired) {
          setOtpCode("");
          setOtpSent(false);
          setStatus("");
          setError("Admin session expired. Please send OTP and sign in again.");
        }
      } catch (accessError) {
        if (isNetworkError(accessError)) {
          setError(NETWORK_ERROR_MESSAGE);
          return;
        }

        setAuthorized(false);
        setSignedInEmail("");
        setError(accessError?.message || "Could not verify admin session.");
      } finally {
        setCheckingAccess(false);
      }
    },
    [resolveAdminSession]
  );

  React.useEffect(() => {
    refreshAccess(true).catch(() => undefined);
  }, [refreshAccess]);

  React.useEffect(() => {
    const {
      data: { subscription },
    } = adminSupabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthorized(false);
        setSignedInEmail("");
        setCheckingAccess(false);
        return;
      }

      refreshAccess(false).catch(() => undefined);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [adminEmail, refreshAccess]);

  async function login() {
    const nowMs = Date.now();
    if (otpCooldownUntil > nowMs) {
      const waitSeconds = Math.max(1, Math.ceil((otpCooldownUntil - nowMs) / 1000));
      setError(`Please wait ${waitSeconds}s before requesting another OTP.`);
      return;
    }

    setError("");
    setStatus("");
    setAuthLoading(true);

    try {
      await sendAdminOtpCode();
      setOtpSent(true);
      setOtpCooldownUntil(Date.now() + 60_000);
      setStatus("OTP code sent to admin email. Enter the code to continue.");
    } catch (authError) {
      if (String(authError?.status || "") === "429" || /rate limit|too many/i.test(String(authError?.message || ""))) {
        setOtpCooldownUntil(Date.now() + 120_000);
        setError("Too many OTP requests right now. Please wait a minute and try again.");
      } else if (isNetworkError(authError)) {
        setError(NETWORK_ERROR_MESSAGE);
      } else
      if (/signups not allowed for otp/i.test(String(authError?.message || ""))) {
        setError(
          `Admin account ${adminEmail} is not provisioned in Supabase Auth yet. Create this user once in Supabase Auth > Users, then retry.`
        );
      } else {
        setError(authError?.message || "Admin login failed.");
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setStatus("");
    setAuthLoading(true);

    try {
      await verifyAdminOtpCode(otpCode);
      setOtpCode("");
      setOtpSent(false);
      setStatus("Admin verification successful.");
      await refreshAccess(false);
    } catch (authError) {
      if (isNetworkError(authError)) {
        setError(NETWORK_ERROR_MESSAGE);
        return;
      }
      setError(authError?.message || "OTP verification failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    setError("");
    setStatus("");
    setAuthLoading(true);

    try {
      await signOutAdmin();
      setAuthorized(false);
      setSignedInEmail("");
      setOtpCode("");
      setOtpSent(false);
      setStatus("Signed out successfully.");
    } catch (authError) {
      setError(authError?.message || "Could not sign out admin session.");
    } finally {
      setAuthLoading(false);
    }
  }

  return {
    checkingAccess,
    authorized,
    authLoading,
    signedInEmail,
    otpCode,
    setOtpCode,
    otpSent,
    otpCooldownSeconds: Math.max(0, Math.ceil((otpCooldownUntil - Date.now()) / 1000)),
    status,
    error,
    setError,
    login,
    verifyOtp,
    logout,
    refreshAccess,
  };
}
