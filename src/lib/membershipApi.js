import { supabase } from "./supabaseClient";
import { getOrCreateSessionId } from "./cartApi";
import { ensureSupabaseGuestSession } from "./authSession";

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

export async function getMembershipIdentity() {
  await ensureSupabaseGuestSession().catch(() => undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    user,
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

export async function signInWithMagicLink(email) {
  const normalized = String(email || "").trim();

  if (!normalized) {
    throw new Error("Email is required");
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: window.location.href,
    },
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

  let query = supabase.from("membership_profiles").select("*").limit(1);
  if (user?.id) {
    query = query.eq("auth_user_id", user.id);
  } else {
    query = query.eq("guest_session_id", guestSessionId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data;
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
  if (!record.consent_to_process || !record.consent_to_ai) {
    throw new Error("Consent is required to continue");
  }

  const conflictColumn = user?.id ? "auth_user_id" : "guest_session_id";

  const { data, error } = await supabase
    .from("membership_profiles")
    .upsert(record, { onConflict: conflictColumn })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (user?.id) {
    await linkGuestProfileToUser(user.id, guestSessionId);
  }

  return data;
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

export async function getMembershipRecommendations(profileId, products = []) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${baseUrl}/functions/v1/generate-membership-recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${session?.access_token || anonKey}`,
    },
    body: JSON.stringify({
      profileId,
      guestSessionId: getOrCreateSessionId(),
      products,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Recommendation request failed (${response.status})`);
  }

  return Array.isArray(body?.recommendations) ? body.recommendations : [];
}
