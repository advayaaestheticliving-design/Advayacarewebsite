import { authorizedAdminFetch, getAdminFunctionUrl } from "./adminOrdersApi";

export async function getAdminAffiliates(period = "all") {
  const url = `${getAdminFunctionUrl("admin-affiliates")}?period=${encodeURIComponent(period)}`;
  const response = await authorizedAdminFetch(url, {
    method: "GET",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch affiliates (${response.status})`);
  }

  return Array.isArray(body?.affiliates) ? body.affiliates : [];
}

export async function createAdminAffiliateCoupon(payload) {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-affiliates"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to create affiliate coupon (${response.status})`);
  }

  return body;
}
