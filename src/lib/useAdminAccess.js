import React from "react";
import {
  getAdminEmail,
  sendAdminOtpCode,
  verifyAdminOtpCode,
  signOutAdmin,
} from "./adminOrdersApi";
import { supabase } from "./supabaseClient";

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

export function useAdminAccess() {
  const adminEmail = getAdminEmail();
  const [checkingAccess, setCheckingAccess] = React.useState(true);
  const [authorized, setAuthorized] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [signedInEmail, setSignedInEmail] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");

  const clearLocalSession = React.useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }, []);

  const resolveAdminSession = React.useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const initialSessionEmail = String(session?.user?.email || "").trim().toLowerCase();
    const hasAccessToken = Boolean(String(session?.access_token || "").trim());
    const hasRefreshToken = Boolean(String(session?.refresh_token || "").trim());

    let sessionEmail = initialSessionEmail;

    if (!sessionEmail && hasAccessToken && hasRefreshToken) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      sessionEmail = String(user?.email || "").trim().toLowerCase();
    }

    if (!sessionEmail) {
      if (hasAccessToken && !hasRefreshToken) {
        await clearLocalSession();
        return { email: "", authorized: false, expired: true };
      }

      return { email: "", authorized: false, expired: false };
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

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData?.session?.access_token) {
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
    } = supabase.auth.onAuthStateChange((event) => {
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
    setError("");
    setStatus("");
    setAuthLoading(true);

    try {
      await sendAdminOtpCode();
      setOtpSent(true);
      setStatus("OTP code sent to admin email. Enter the code to continue.");
    } catch (authError) {
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
    status,
    error,
    setError,
    login,
    verifyOtp,
    logout,
    refreshAccess,
  };
}
