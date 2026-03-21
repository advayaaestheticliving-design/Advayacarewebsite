import React from "react";
import { supabase } from "../lib/supabaseClient";

const MemberSessionContext = React.createContext({
  authReady: false,
  user: null,
  isAuthenticated: false,
  lastAuthEvent: "INITIAL_SESSION",
});

export function MemberSessionProvider({ children }) {
  const [state, setState] = React.useState({
    authReady: false,
    user: null,
    isAuthenticated: false,
    lastAuthEvent: "INITIAL_SESSION",
  });

  React.useEffect(() => {
    let mounted = true;

    const applySession = (session, event = "INITIAL_SESSION") => {
      if (!mounted) {
        return;
      }

      const user = session?.user || null;

      setState((prev) => ({
        authReady: true,
        user,
        isAuthenticated: Boolean(user?.id),
        lastAuthEvent:
          event === "TOKEN_REFRESHED" && prev.lastAuthEvent
            ? prev.lastAuthEvent
            : event,
      }));
    };

    supabase.auth.getSession().then(({ data }) => {
      applySession(data?.session || null, "INITIAL_SESSION");
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