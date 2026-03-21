import { supabase } from "./supabaseClient";
import { getOrCreateSessionId } from "./cartApi";

export const initialMembershipProfileForm = {
  skin_type: "",
  concerns: "",
  allergies: "",
  avoid_ingredients: "",
  sun_exposure: "",
  sleep_hours: "",
  stress_level: "",
  water_intake: "",
  routine_steps: "",
  current_products: "",
  consent_to_process: false,
  consent_to_ai: false,
};

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIndianPhone(phone) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

function toTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function findMembershipProfileByIdentity({ authUserId = null, guestSessionId = null, allowGuestFallback = false }) {
  if (authUserId) {
    const { data, error } = await supabase
      .from("membership_profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  if (guestSessionId && (!authUserId || allowGuestFallback)) {
    const { data, error } = await supabase
      .from("membership_profiles")
      .select("*")
      .eq("guest_session_id", guestSessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  return null;
}

export function mapMembershipProfileToForm(profile) {
  if (!profile) {
    return { ...initialMembershipProfileForm };
  }

  return {
    skin_type: profile.skin_type || "",
    concerns: (profile.concerns || []).join(", "),
    allergies: (profile.allergies || []).join(", "),
    avoid_ingredients: (profile.avoid_ingredients || []).join(", "),
    sun_exposure: profile.sun_exposure || "",
    sleep_hours: profile.sleep_hours || "",
    stress_level: profile.stress_level || "",
    water_intake: profile.water_intake || "",
    routine_steps: profile.routine_steps || "",
    current_products: profile.current_products || "",
    consent_to_process: Boolean(profile.consent_to_process),
    consent_to_ai: Boolean(profile.consent_to_ai),
  };
}

export function isRecommendationRunFresh(profile, recommendationRun) {
  if (!profile?.updated_at || !recommendationRun?.created_at) {
    return false;
  }

  return toTimestamp(recommendationRun.created_at) >= toTimestamp(profile.updated_at);
}

export async function getMembershipIdentity() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    user: session?.user || null,
    guestSessionId: getOrCreateSessionId(),
  };
}

export async function signUpWithEmailPassword(email, password, phone) {
  const normalized = String(email || "").trim();
  const normalizedPassword = String(password || "");
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalized || !normalizedPassword || !phone) {
    throw new Error("Email, password, and phone number are required");
  }

  if (!normalizedPhone) {
    throw new Error("Please enter a valid 10-digit Indian mobile number");
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password: normalizedPassword,
    options: {
      data: {
        phone: normalizedPhone,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithEmailPassword(email, password) {
  const normalized = String(email || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalized || !normalizedPassword) {
    throw new Error("Email and password are required");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password: normalizedPassword,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.href,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOutMembership() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getMembershipProfile() {
  const { user, guestSessionId } = await getMembershipIdentity();

  return findMembershipProfileByIdentity({
    authUserId: user?.id ?? null,
    guestSessionId: user?.id ? null : guestSessionId,
  });
}

export async function saveMembershipProfile(payload) {
  const { user, guestSessionId } = await getMembershipIdentity();

  const record = {
    auth_user_id: user?.id ?? null,
    guest_session_id: user?.id ? null : guestSessionId,
    skin_type: String(payload.skin_type || "").trim(),
    concerns: toArray(payload.concerns),
    allergies: toArray(payload.allergies),
    avoid_ingredients: toArray(payload.avoid_ingredients),
    sun_exposure: String(payload.sun_exposure || "").trim(),
    sleep_hours: String(payload.sleep_hours || "").trim(),
    stress_level: String(payload.stress_level || "").trim(),
    water_intake: String(payload.water_intake || "").trim(),
    routine_steps: String(payload.routine_steps || "").trim(),
    current_products: String(payload.current_products || "").trim(),
    consent_to_process: Boolean(payload.consent_to_process),
    consent_to_ai: Boolean(payload.consent_to_ai),
    consent_version: "v1",
  };

  if (!record.skin_type) {
    throw new Error("Skin type is required");
  }
  if (!record.consent_to_process) {
    throw new Error("Consent to process your profile is required");
  }

  const existingProfile = await findMembershipProfileByIdentity({
    authUserId: user?.id ?? null,
    guestSessionId,
    allowGuestFallback: Boolean(user?.id),
  });

  const writePayload = existingProfile?.id
    ? {
        ...record,
        auth_user_id: user?.id ?? existingProfile.auth_user_id ?? null,
        guest_session_id: user?.id ? null : guestSessionId,
      }
    : record;

  const query = existingProfile?.id
    ? supabase.from("membership_profiles").update(writePayload).eq("id", existingProfile.id)
    : supabase.from("membership_profiles").insert(writePayload);

  const { data, error } = await query.select("*").single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getLatestMembershipRecommendationRun(profileId) {
  if (!profileId) {
    return null;
  }

  const { data, error } = await supabase
    .from("membership_recommendation_runs")
    .select("id, recommendations, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data || null;
}

export async function linkGuestProfileToUser(userId, guestSessionId) {
  if (!userId || !guestSessionId) {
    return;
  }

  const { data: guestProfile } = await supabase
    .from("membership_profiles")
    .select("id")
    .eq("guest_session_id", guestSessionId)
    .limit(1)
    .single();

  if (!guestProfile?.id) {
    return;
  }

  await supabase
    .from("membership_profiles")
    .update({ auth_user_id: userId, guest_session_id: null })
    .eq("id", guestProfile.id);
}

async function getRecommendationAccessToken({ forceRefresh = false } = {}) {
  const sessionResult = forceRefresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
  const session = sessionResult?.data?.session || null;
  const accessToken = session?.access_token || "";

  if (accessToken) {
    return accessToken;
  }

  if (session?.user) {
    throw new Error("Your member session expired. Sign in again to refresh AI recommendations.");
  }

  throw new Error("Sign in to refresh AI recommendations.");
}

export async function getMembershipRecommendations(profileId, products = []) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const requestRecommendations = async (accessToken) => {
    const response = await fetch(`${baseUrl}/functions/v1/generate-membership-recommendations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        profileId,
        guestSessionId: getOrCreateSessionId(),
        products,
      }),
    });

    const body = await response.json().catch(() => null);

    return { response, body };
  };

  let accessToken = await getRecommendationAccessToken();
  let { response, body } = await requestRecommendations(accessToken);

  if (response.status === 401) {
    accessToken = await getRecommendationAccessToken({ forceRefresh: true });
    ({ response, body } = await requestRecommendations(accessToken));
  }

  if (!response.ok) {
    throw new Error(body?.error || `Recommendation request failed (${response.status})`);
  }

  return Array.isArray(body?.recommendations) ? body.recommendations : [];
}
