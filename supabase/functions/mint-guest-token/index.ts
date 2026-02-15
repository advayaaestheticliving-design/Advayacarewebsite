// Supabase Edge Function: mint-guest-token
// Issues a short-lived JWT that carries a session_id claim

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "";

if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set for mint-guest-token function");
}
Deno.serve(async (req) => { 
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId ?? body?.session_id;

    if (!sessionId || typeof sessionId !== "string") {
      return new Response(
        JSON.stringify({ error: "sessionId (string) is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!JWT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Function misconfigured: missing JWT secret" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = {
      sub: `anon-${sessionId}`,
      session_id: sessionId,
      role: "authenticated",
    };

      const accessToken = await signJwt(payload, JWT_SECRET, 7 * 24 * 60 * 60);

    return new Response(JSON.stringify({ access_token: accessToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("mint-guest-token error", error);
    return new Response(
      JSON.stringify({ error: "Failed to mint guest token" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number
) {
  const header = { alg: "HS256", typ: "JWT" };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureB64 = await signHmacSha256(signingInput, secret);

  return `${signingInput}.${signatureB64}`;
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signHmacSha256(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input)
  );

  return base64UrlEncode(new Uint8Array(signature));
}
