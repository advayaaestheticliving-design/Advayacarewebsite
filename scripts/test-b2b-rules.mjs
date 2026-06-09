import assert from "node:assert/strict";
import {
  availableSampleCredit,
  calculateAccountScore,
  calculateTradeTerms,
  canContinueOutreach,
  validateQuoteRules,
} from "../src/lib/b2bRules.mjs";

const standard = calculateTradeTerms(1000, 300);
assert.equal(standard.wholesalePrice, 650);
assert.equal(standard.eligible, true);
assert.ok(standard.partnerMargin >= 0.30);
assert.ok(standard.brandMargin >= 0.45);

const blocked = calculateTradeTerms(1000, 500);
assert.equal(blocked.eligible, false);
assert.ok(blocked.partnerMargin < 0.30);

assert.equal(calculateAccountScore({
  businessType: "salon_spa", city: "Bangalore", state: "Karnataka",
  premiumPositioning: true, retailsProducts: true, socialActive: true,
  hasEmail: true, hasPhone: true, locationCount: 3,
}), 100);

assert.equal(validateQuoteRules("opening_order", [
  { unitPrice: 1000, quantity: 6 }, { unitPrice: 1000, quantity: 6 },
]), true);
assert.equal(validateQuoteRules("opening_order", [{ unitPrice: 1200, quantity: 10 }]), false);
assert.equal(validateQuoteRules("reorder", [{ unitPrice: 1250, quantity: 6 }]), true);
assert.equal(validateQuoteRules("sample_kit", [
  { unitPrice: 700, quantity: 1 }, { unitPrice: 700, quantity: 1 }, { unitPrice: 700, quantity: 1 },
]), true);

assert.equal(canContinueOutreach({ stage: "contacted", optedOut: false, bounced: false }), true);
assert.equal(canContinueOutreach({ stage: "replied", optedOut: false, bounced: false }), false);
assert.equal(canContinueOutreach({ stage: "contacted", optedOut: true, bounced: false }), false);

assert.equal(availableSampleCredit({
  status: "active", remainingInr: 2100, expiresAt: "2026-07-01T00:00:00.000Z",
}, 12000, new Date("2026-06-10T00:00:00.000Z")), 2100);
assert.equal(availableSampleCredit({
  status: "active", remainingInr: 2100, expiresAt: "2026-06-01T00:00:00.000Z",
}, 12000, new Date("2026-06-10T00:00:00.000Z")), 0);
assert.equal(availableSampleCredit({
  status: "active", remainingInr: 2100, expiresAt: "2026-07-01T00:00:00.000Z",
}, 11999, new Date("2026-06-10T00:00:00.000Z")), 0);

console.log("B2B commercial rule tests passed.");
