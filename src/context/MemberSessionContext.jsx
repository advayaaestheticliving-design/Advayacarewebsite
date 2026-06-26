import React from "react";
import { supabase } from "../lib/supabaseClient";

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(() => resolve({ data: { session: null } }), timeoutMs);
    }),
  ]);
}

const MemberSessionContext = React.createContext({
  authReady: false,
  user: null,
  isAuthenticated: false,
  accessToken: null,
  lastAuthEvent: "INITIAL_SESSION",
});

export function MemberSessionProvider({ children }) {
  const [state, setState] = React.useState({
    authReady: false,
    user: null,
    isAuthenticated: false,
    accessToken: null,
    lastAuthEvent: "INITIAL_SESSION",
  });

  React.useEffect(() => {
    let mounted = true;

    const applySession = (session, event = "INITIAL_SESSION") => {
      if (!mounted) {
        return;
      }

      const user = session?.user || null;
      const accessToken = session?.access_token || null;

      setState((prev) => {
        const sameUser = prev.user?.id && user?.id && prev.user.id === user.id;
        const isRepeatedSameUserEvent =
          sameUser &&
          prev.authReady &&
          (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "INITIAL_SESSION");

        if (isRepeatedSameUserEvent) {
          // Still update accessToken in case it refreshed.
          return prev.accessToken === accessToken ? prev : { ...prev, accessToken };
        }

        return {
          authReady: true,
          user,
          isAuthenticated: Boolean(user?.id),
          accessToken,
          lastAuthEvent:
            event === "TOKEN_REFRESHED" && prev.lastAuthEvent
              ? prev.lastAuthEvent
              : event,
        };
      });
    };

    withTimeout(supabase.auth.getSession(), AUTH_BOOTSTRAP_TIMEOUT_MS)
      .then(({ data }) => {
        applySession(data?.session || null, "INITIAL_SESSION");
      })
      .catch(() => {
        applySession(null, "INITIAL_SESSION");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(session, event);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return <MemberSessionContext.Provider value={state}>{children}</MemberSessionContext.Provider>;
}

export function useMemberSession() {
  return React.useContext(MemberSessionContext);
}