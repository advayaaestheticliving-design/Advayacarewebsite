import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GITHUB_PAT = Deno.env.get("GITHUB_PAT");
const GITHUB_OWNER = "advayaaestheticliving-design";
const GITHUB_REPO = "Advayacarewebsite";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }
  return authHeader.slice("Bearer ".length).trim();
}

async function getRequestUser(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string
) {
  const token = parseBearerToken(req);
  if (!token || token === "undefined" || token === "null") {
    return { user: null, error: "Missing authorization token" };
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: serviceData,
    error: serviceError,
  } = await serviceClient.auth.getUser(token);

  if (!serviceError && serviceData?.user) {
    return { user: serviceData.user, error: null };
  }

  if (anonKey) {
    const anonClient = createClient(supabaseUrl, anonKey);
    const {
      data: anonData,
      error: anonError,
    } = await anonClient.auth.getUser(token);

    if (!anonError && anonData?.user) {
      return { user: anonData.user, error: null };
    }

    return {
      user: null,
      error: anonError?.message || serviceError?.message || "Invalid or expired authorization token",
    };
  }

  return {
    user: null,
    error: serviceError?.message || "Invalid or expired authorization token",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return jsonResponse({ error: "Missing Supabase env vars" }, 500);
    }

    const { user, error: authError } = await getRequestUser(
      req,
      supabaseUrl,
      supabaseServiceKey,
      supabaseAnonKey
    );

    if (authError || !user) {
      return jsonResponse({ error: authError || "Unauthorized" }, 401);
    }

    const requesterEmail = String(user.email || "").trim().toLowerCase();
    const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
    if (!requesterEmail || requesterEmail !== ADMIN_EMAIL) {
      return jsonResponse({ error: "Unauthorized - Admin only" }, 403);
    }

    const { source, location, keyword } = await req.json();

    if (!source || !location || !keyword) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    if (!GITHUB_PAT) {
      return jsonResponse({ error: "GITHUB_PAT secret is missing in Supabase." }, 500);
    }

    let workflowId = "";
    if (source === "google_maps") {
      workflowId = "scrape-google-maps.yml";
    } else if (source === "local_directory") {
      workflowId = "scrape-local-directories.yml";
    } else {
      return jsonResponse({ error: "Invalid source" }, 400);
    }

    console.log(`Triggering GitHub Action: ${workflowId} for ${keyword} in ${location}`);

    const githubResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${workflowId}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `token ${GITHUB_PAT}`,
          "User-Agent": "Advayacare-Admin",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            location: location,
            keyword: keyword,
          },
        }),
      }
    );

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error("GitHub API Error:", errorText);
      return jsonResponse({ error: `Failed to trigger GitHub Action: ${githubResponse.statusText}` }, 500);
    }

    return jsonResponse({ success: true, message: "Scraping job started successfully." });
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
});
