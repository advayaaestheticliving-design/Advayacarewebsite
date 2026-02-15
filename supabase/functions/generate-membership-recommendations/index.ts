import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

type Product = {
  id: string;
  name: string;
  price_inr?: number;
  filterTags?: string[];
  filter_tags?: string[];
  ingredients?: string;
  one_line_summary?: string;
  benefits_brief?: string;
  benefits_detail?: string;
  use_cases?: string;
};

type Profile = {
  id: string;
  auth_user_id: string | null;
  guest_session_id: string | null;
  skin_type: string;
  concerns: string[];
  allergies: string[];
  avoid_ingredients: string[];
  sun_exposure: string;
  sleep_hours: string;
  stress_level: string;
  water_intake: string;
  routine_steps: string;
  current_products: string;
  consent_to_ai: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const concernKeywords: Record<string, string[]> = {
  acne: ["acne", "breakout", "clar", "pore", "sebum", "oil"],
  pigmentation: ["pigment", "bright", "spot", "tone", "radiance"],
  dryness: ["hydr", "moist", "barrier", "nourish", "plump"],
  sensitivity: ["sooth", "calm", "sensitive", "redness", "irrit"],
  aging: ["firm", "wrinkle", "line", "collagen", "elastic"],
  dullness: ["glow", "radiance", "bright", "renew"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRole) {
      return jsonError("Function misconfigured", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    const body = await req.json().catch(() => ({}));
    const profileId = typeof body.profileId === "string" ? body.profileId : null;
    const guestSessionIdBody = typeof body.guestSessionId === "string" ? body.guestSessionId : null;
    const productsFromBody = Array.isArray(body.products) ? body.products : [];

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const jwtPayload = parseJwtPayload(jwt);
    const guestSessionIdClaim = typeof jwtPayload?.session_id === "string" ? jwtPayload.session_id : null;

    const {
      data: { user },
    } = await supabase.auth.getUser(jwt);

    const profile = await resolveProfile(supabase, {
      profileId,
      authUserId: user?.id ?? null,
      guestSessionId: guestSessionIdBody || guestSessionIdClaim,
    });

    if (!profile) {
      return jsonError("Membership profile not found", 404);
    }

    if (!profile.consent_to_ai) {
      return jsonError("AI recommendations require consent", 400);
    }

    const products = await loadProducts(supabase, productsFromBody);
    if (products.length === 0) {
      return jsonError("No products available for recommendations", 400);
    }

    const deterministic = deterministicRecommendations(profile, products, 8);
    const aiRecommended = await aiRankRecommendations(profile, deterministic);
    const finalRecommendations = aiRecommended.length > 0 ? aiRecommended : deterministic;

    const modelName = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

    await supabase.from("membership_recommendation_runs").insert({
      profile_id: profile.id,
      auth_user_id: profile.auth_user_id,
      guest_session_id: profile.guest_session_id,
      model_provider: "gemini",
      model_name: modelName,
      input_snapshot: {
        skin_type: profile.skin_type,
        concerns: profile.concerns,
        allergies: profile.allergies,
        avoid_ingredients: profile.avoid_ingredients,
        sun_exposure: profile.sun_exposure,
        sleep_hours: profile.sleep_hours,
        stress_level: profile.stress_level,
        water_intake: profile.water_intake,
        routine_steps: profile.routine_steps,
        current_products: profile.current_products,
      },
      recommendations: finalRecommendations,
    });

    return new Response(
      JSON.stringify({
        success: true,
        profileId: profile.id,
        recommendations: finalRecommendations,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("generate-membership-recommendations error", error);
    return jsonError("Internal server error", 500);
  }
});

async function resolveProfile(
  supabase: ReturnType<typeof createClient>,
  params: { profileId: string | null; authUserId: string | null; guestSessionId: string | null }
): Promise<Profile | null> {
  const { profileId, authUserId, guestSessionId } = params;

  let query = supabase.from("membership_profiles").select("*").limit(1);

  if (profileId) {
    query = query.eq("id", profileId);
  } else if (authUserId) {
    query = query.eq("auth_user_id", authUserId);
  } else if (guestSessionId) {
    query = query.eq("guest_session_id", guestSessionId);
  } else {
    return null;
  }

  const { data, error } = await query.single();
  if (error || !data) {
    return null;
  }

  return data as Profile;
}

async function loadProducts(
  supabase: ReturnType<typeof createClient>,
  bodyProducts: Product[]
): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, price_inr, filter_tags, ingredients, one_line_summary, benefits_brief, benefits_detail, use_cases")
    .limit(200);

  if (Array.isArray(data) && data.length > 0) {
    return data as Product[];
  }

  return bodyProducts.filter((item) => item && typeof item.id === "string");
}

function deterministicRecommendations(profile: Profile, products: Product[], limit = 6) {
  const avoid = (profile.avoid_ingredients || []).map((item) => item.toLowerCase().trim()).filter(Boolean);
  const allergies = (profile.allergies || []).map((item) => item.toLowerCase().trim()).filter(Boolean);
  const concernTerms = (profile.concerns || []).flatMap((concern) => {
    const key = String(concern || "").toLowerCase().trim();
    return concernKeywords[key] || [key];
  });

  const scored: Array<Record<string, unknown>> = [];

  for (const product of products) {
    const ingredients = String(product.ingredients || "").toLowerCase();
    const searchable = [
      product.name,
      product.one_line_summary,
      product.benefits_brief,
      product.benefits_detail,
      product.use_cases,
      ingredients,
      ...(product.filterTags || []),
      ...(product.filter_tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const hasAvoid = avoid.some((term) => term && ingredients.includes(term));
    const hasAllergy = allergies.some((term) => term && ingredients.includes(term));

    if (hasAvoid || hasAllergy) {
      continue;
    }

    let score = 0;
    for (const term of concernTerms) {
      if (term && searchable.includes(term)) {
        score += 2;
      }
    }

    const skinType = profile.skin_type.toLowerCase();
    if (skinType.includes("oily") && searchable.includes("oil")) {
      score += 1;
    }
    if (skinType.includes("dry") && (searchable.includes("hydr") || searchable.includes("moist"))) {
      score += 1;
    }
    if (skinType.includes("sensitive") && (searchable.includes("sooth") || searchable.includes("calm"))) {
      score += 1;
    }

    scored.push({
      id: product.id,
      name: product.name,
      price_inr: product.price_inr,
      score,
      reason: "Matched to your skin profile and concerns.",
    });
  }

  scored.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  return scored.slice(0, limit);
}

async function aiRankRecommendations(profile: Profile, candidates: Array<Record<string, unknown>>) {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

  if (!apiKey || candidates.length === 0) {
    return [];
  }

  const prompt = [
    "You are a skincare product recommendation assistant.",
    "Return ONLY valid JSON with shape:",
    '{"recommendations":[{"id":"product-id","score":0-100,"reason":"short reason","caution":"optional caution"}]}',
    "Do not recommend any product that conflicts with avoid ingredients or allergies.",
    "Profile:",
    JSON.stringify({
      skin_type: profile.skin_type,
      concerns: profile.concerns,
      allergies: profile.allergies,
      avoid_ingredients: profile.avoid_ingredients,
      sun_exposure: profile.sun_exposure,
      sleep_hours: profile.sleep_hours,
      stress_level: profile.stress_level,
      water_intake: profile.water_intake,
      routine_steps: profile.routine_steps,
      current_products: profile.current_products,
    }),
    "Candidates:",
    JSON.stringify(candidates),
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "You are precise and safety-first." }],
      },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  }
  );

  if (!response.ok) {
    console.error("Gemini request failed", response.status);
    return [];
  }

  const payload = await response.json().catch(() => null);
  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content || typeof content !== "string") {
    return [];
  }

  const parsed = safeParseJson(content);
  const list = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];

  const byId = new Map(candidates.map((item) => [String(item.id), item]));

  return list
    .map((rec) => {
      const id = String(rec?.id || "");
      const source = byId.get(id);
      if (!source) {
        return null;
      }

      return {
        id,
        name: source.name,
        price_inr: source.price_inr,
        score: Number(rec?.score || source.score || 0),
        reason: typeof rec?.reason === "string" ? rec.reason : source.reason,
        caution: typeof rec?.caution === "string" ? rec.caution : "",
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  if (!token || token.split(".").length < 2) {
    return null;
  }

  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function safeParseJson(input: string): Record<string, unknown> {
  try {
    return JSON.parse(input);
  } catch {
    const match = input.match(/\{[\s\S]*\}/);
    if (!match) {
      return {};
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
