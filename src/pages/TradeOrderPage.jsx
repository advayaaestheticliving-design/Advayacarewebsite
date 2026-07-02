import React from "react";
import { Link, useParams } from "react-router-dom";
import RazorpayCheckout from "../components/RazorpayCheckout";
import { createTradeOrder, previewTradeQuote } from "../lib/b2bApi";

function currency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

const inputClass = "w-full rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-black outline-none focus:border-[#D4AF37]";

function TradeOrderPage() {
  const { token } = useParams();
  const [quote, setQuote] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [order, setOrder] = React.useState(null);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [paid, setPaid] = React.useState(false);
  const [customer, setCustomer] = React.useState({
    name: "", email: "", phone: "", address: "", addressLine2: "", city: "", state: "", pinCode: "",
  });

  const loadQuote = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await previewTradeQuote(token);
      setQuote(result.quote);
      setPaid(result.quote?.status === "paid");
      setCustomer((current) => ({
        ...current,
        name: current.name || result.quote?.contact?.full_name || "",
        email: current.email || result.quote?.contact?.email || "",
        phone: current.phone || result.quote?.contact?.phone || result.quote?.contact?.whatsapp_phone || "",
        address: current.address || result.quote?.deliveryAddress || "",
        city: current.city || result.quote?.deliveryCity || "",
        state: current.state || result.quote?.deliveryState || "",
        pinCode: current.pinCode || result.quote?.deliveryPinCode || "",
      }));
    } catch (loadError) {
      setError(loadError?.message || "This trade quote is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadQuote().catch(() => undefined);
  }, [loadQuote]);

  function update(event) {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: value }));
  }

  async function beginCheckout(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const payload = {
        ...customer,
        address: customer.addressLine2 ? `${customer.address}, ${customer.addressLine2}` : customer.address
      };
      const result = await createTradeOrder(token, payload);
      setOrder(result.order);
      setPaymentOpen(true);
    } catch (createError) {
      setError(createError?.message || "Could not start the secure checkout.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="py-20 text-center text-white/70">Loading secure trade quote...</p>;
  if (error && !quote) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-red-400/30 bg-black/70 p-10 text-center text-white">
        <h1 className="text-2xl font-semibold">Quote unavailable</h1>
        <p className="mt-3 text-white/70">{error}</p>
        <Link className="mt-6 inline-block text-[#D4AF37] underline" to="/trade">Return to trade</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 text-white">
      <section className="rounded-3xl border border-[#D4AF37]/40 bg-black/70 p-7 sm:p-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#D4AF37]">Secure Advaya Care trade quote</p>
            <h1 className="mt-3 text-3xl font-semibold">{quote.businessName}</h1>
            <p className="mt-2 text-sm text-white/60">{quote.quoteNumber} · {String(quote.quoteType).replace(/_/g, " ")}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-white/60">Amount payable</p>
            <p className="text-3xl font-semibold text-[#D4AF37]">{currency(quote.totalInr)}</p>
            <p className="mt-1 text-xs text-white/50">Valid until {new Date(quote.expiresAt).toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </section>

      {paid ? (
        <section className="rounded-3xl bg-[#D4AF37] p-8 text-black">
          <h2 className="text-2xl font-semibold">Payment received</h2>
          <p className="mt-2 text-sm">Thank you. Advaya Care will process this trade order and share fulfillment updates by email or phone.</p>
        </section>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-white/15 bg-black/60 p-6">
            <h2 className="text-xl font-semibold">Quote items</h2>
            <div className="mt-5 divide-y divide-white/10">
              {quote.items.map((item) => (
                <div key={item.product_id} className="flex justify-between gap-4 py-4 text-sm">
                  <div><p className="font-medium">{item.name}</p><p className="text-white/50">{item.quantity} × {currency(item.unit_price_inr)}</p></div>
                  <p>{currency(item.line_total_inr)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-white/15 pt-4 text-sm">
              <div className="flex justify-between"><span className="text-white/60">Subtotal</span><span>{currency(quote.subtotalInr)}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Shipping</span><span>{currency(quote.shippingInr)}</span></div>
              {Number(quote.creditInr) > 0 ? <div className="flex justify-between text-[#D4AF37]"><span>Sample credit</span><span>-{currency(quote.creditInr)}</span></div> : null}
              <div className="flex justify-between pt-2 text-lg font-semibold"><span>Total</span><span>{currency(quote.totalInr)}</span></div>
            </div>
          </section>

          <form onSubmit={beginCheckout} className="space-y-4 rounded-3xl border border-white/15 bg-black/60 p-6">
            <h2 className="text-xl font-semibold">Delivery and billing contact</h2>
            <input className={inputClass} name="name" value={customer.name} onChange={update} placeholder="Contact name" required />
            <input className={inputClass} name="email" type="email" value={customer.email} onChange={update} placeholder="Email" required />
            <input className={inputClass} name="phone" value={customer.phone} onChange={update} placeholder="Phone" required />
            <textarea className={`${inputClass} min-h-24 resize-y`} name="address" value={customer.address} onChange={update} placeholder="Delivery address Line 1" required />
            <input className={inputClass} name="addressLine2" value={customer.addressLine2} onChange={update} placeholder="Delivery address Line 2 (Optional)" />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputClass} name="city" value={customer.city} onChange={update} placeholder="City" />
              <input className={inputClass} name="state" value={customer.state} onChange={update} placeholder="State" />
            </div>
            <input className={inputClass} name="pinCode" value={customer.pinCode} onChange={update} placeholder="Pin code" required />
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <p className="text-xs leading-relaxed text-white/50">
              This quote is prepaid. Prices, stock, credit, and delivery charges are validated again on the server before Razorpay opens.
            </p>
            <button disabled={creating} className="w-full rounded-full bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black disabled:opacity-60">
              {creating ? "Preparing checkout..." : `Pay ${currency(quote.totalInr)}`}
            </button>
          </form>
        </div>
      )}

      {order ? (
        <RazorpayCheckout
          orderId={order.id}
          amount={Number(order.amount || quote.totalInr)}
          items={quote.items}
          customerEmail={customer.email}
          customerName={customer.name}
          customerPhone={customer.phone}
          customerAddress={[customer.address, customer.addressLine2, customer.city, customer.state].filter(Boolean).join(", ")}
          customerPinCode={customer.pinCode}
          isOpen={paymentOpen}
          onCancel={() => setPaymentOpen(false)}
          onError={(paymentError) => setError(paymentError?.message || "Payment could not be completed.")}
          onSuccess={() => {
            setPaymentOpen(false);
            setPaid(true);
            loadQuote().catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}

export default TradeOrderPage;
