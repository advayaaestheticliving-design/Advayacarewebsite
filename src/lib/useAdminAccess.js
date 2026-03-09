import React from "react";
import {
  getAdminEmail,
  isCurrentUserAdmin,
  sendAdminOtpCode,
  verifyAdminOtpCode,
  signOutAdmin,
} from "./adminOrdersApi";
import { supabase } from "./supabaseClient";

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

  const refreshAccess = React.useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setCheckingAccess(true);
      }
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const sessionEmail = String(session?.user?.email || "").trim().toLowerCase();

        if (sessionEmail) {
          setSignedInEmail(sessionEmail);
          setAuthorized(sessionEmail === adminEmail);
          return;
        }

        const isAdmin = await isCurrentUserAdmin();
        setAuthorized(isAdmin);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        setSignedInEmail(String(user?.email || ""));
      } catch (accessError) {
        setAuthorized(false);
        setSignedInEmail("");
        setError(accessError?.message || "Could not verify admin session.");
      } finally {
        setCheckingAccess(false);
      }
    },
    [adminEmail]
  );

  React.useEffect(() => {
    refreshAccess(true).catch(() => undefined);
  }, [refreshAccess]);

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionEmail = String(session?.user?.email || "").trim().toLowerCase();

      if (event === "SIGNED_OUT") {
        setAuthorized(false);
        setSignedInEmail("");
        setCheckingAccess(false);
        return;
      }

      if (sessionEmail) {
        setSignedInEmail(sessionEmail);
        setAuthorized(sessionEmail === adminEmail);
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
