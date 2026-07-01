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

export async function issueAdminAffiliateCoupon(payload) {
  const url = `${getAdminFunctionUrl("admin-affiliates")}/issue-coupon`;
  const response = await authorizedAdminFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to issue affiliate coupon (${response.status})`);
  }

  return body;
}

export async function getAdminAffiliateApplications(status = "pending") {
  const url = `${getAdminFunctionUrl("admin-affiliate-applications")}?status=${encodeURIComponent(status)}`;
  const response = await authorizedAdminFetch(url, {
    method: "GET",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch applications (${response.status})`);
  }

  return Array.isArray(body?.applications) ? body.applications : [];
}

export async function approveAdminAffiliateApplication(id, commission_rate = 10, custom_code = "") {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-affiliate-applications") + "/approve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, commission_rate, custom_code }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to approve application (${response.status})`);
  }

  return body;
}

export async function rejectAdminAffiliateApplication(id) {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-affiliate-applications") + "/reject", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to reject application (${response.status})`);
  }

  return body;
}

export async function getAdminAffiliateProfile(id) {
  const url = `${getAdminFunctionUrl("admin-affiliates")}?id=${encodeURIComponent(id)}`;
  const response = await authorizedAdminFetch(url, {
    method: "GET",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch affiliate profile (${response.status})`);
  }

  return Array.isArray(body?.affiliates) && body.affiliates.length > 0 ? body.affiliates[0] : null;
}

export async function markAffiliateCommissionsPaid(usageIds, isPaid) {
  const url = `${getAdminFunctionUrl("admin-affiliates")}/payout`;
  const response = await authorizedAdminFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ usage_ids: usageIds, is_paid: isPaid }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to update payouts (${response.status})`);
  }

  return body;
}
