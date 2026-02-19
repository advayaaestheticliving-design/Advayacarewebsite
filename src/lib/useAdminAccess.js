import React from "react";
import {
  getAdminEmail,
  isCurrentUserAdmin,
  signInAdminWithMagicLink,
  signOutAdmin,
} from "./adminOrdersApi";
import { supabase } from "./supabaseClient";

export function useAdminAccess() {
  const [checkingAccess, setCheckingAccess] = React.useState(true);
  const [authorized, setAuthorized] = React.useState(false);
  const [authEmail, setAuthEmail] = React.useState(getAdminEmail());
  const [authLoading, setAuthLoading] = React.useState(false);
  const [signedInEmail, setSignedInEmail] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");

  const refreshAccess = React.useCallback(async () => {
    setCheckingAccess(true);
    setError("");

    try {
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
  }, []);

  React.useEffect(() => {
    refreshAccess().catch(() => undefined);
  }, [refreshAccess]);

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshAccess().catch(() => undefined);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [refreshAccess]);

  async function login() {
    setError("");
    setStatus("");
    setAuthLoading(true);

    try {
      await signInAdminWithMagicLink(authEmail);
      setStatus("Magic link sent. Open the email and continue to admin access.");
    } catch (authError) {
      setError(authError?.message || "Admin login failed.");
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
    authEmail,
    setAuthEmail,
    authLoading,
    signedInEmail,
    status,
    error,
    setError,
    login,
    logout,
    refreshAccess,
  };
}
