export function calculateTradeTerms(retailPrice, unitCost) {
  const retail = Number(retailPrice || 0);
  const cost = Number(unitCost || 0);
  if (retail <= 0 || cost <= 0) {
    return { wholesalePrice: null, partnerMargin: null, brandMargin: null, eligible: false };
  }
  const wholesalePrice = Math.round(Math.max(retail * 0.65, cost / 0.55) * 100) / 100;
  const partnerMargin = (retail - wholesalePrice) / retail;
  const brandMargin = (wholesalePrice - cost) / wholesalePrice;
  return {
    wholesalePrice,
    partnerMargin,
    brandMargin,
    eligible: partnerMargin >= 0.30 && brandMargin >= 0.45,
  };
}

export function calculateAccountScore(account) {
  const type = ["salon", "spa", "salon_spa", "aesthetic_studio"].includes(account.businessType) ? 20 : 5;
  const city = ["bangalore", "bengaluru"].includes(String(account.city || "").toLowerCase())
    ? 20
    : String(account.state || "").toLowerCase() === "karnataka" ? 10 : 2;
  return Math.min(100,
    type + city +
    (account.premiumPositioning ? 15 : 0) +
    (account.retailsProducts ? 15 : 0) +
    (account.socialActive ? 10 : 0) +
    (account.hasEmail ? 8 : 0) +
    (account.hasPhone ? 7 : 0) +
    (Number(account.locationCount || 1) >= 3 ? 5 : Number(account.locationCount || 1) >= 2 ? 3 : 0)
  );
}

export function validateQuoteRules(type, items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const units = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (type === "sample_kit") return items.length === 3 && items.every((item) => Number(item.quantity) === 1);
  if (type === "opening_order") return subtotal >= 12000 && units >= 12 && items.every((item) => Number(item.quantity) >= 2);
  if (type === "reorder") return subtotal >= 7500 && units >= 6;
  return false;
}

export function canContinueOutreach({ stage, optedOut, bounced }) {
  return !optedOut && !bounced && ![
    "replied", "discovery_booked", "sample_paid", "sample_sent", "proposal_sent",
    "won", "lost", "nurture", "suppressed",
  ].includes(stage);
}

export function availableSampleCredit(credit, orderSubtotal, now = new Date()) {
  if (!credit || credit.status !== "active" || new Date(credit.expiresAt) <= now || Number(orderSubtotal) < 12000) return 0;
  return Math.min(Number(credit.remainingInr || 0), Number(orderSubtotal || 0));
}
