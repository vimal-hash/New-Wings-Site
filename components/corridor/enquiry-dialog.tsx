"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ContactLinks } from "./contact-icons";
import { ENQUIRY_LIMITS, validateEnquiry, type Enquiry } from "./enquiry";
import { ENQUIRY_PRODUCTS } from "./hover-catalogue-state";

type Status = "idle" | "sending" | "sent" | "offline" | "failed";
const EMPTY: Enquiry = { name: "", email: "", phone: "", product: "", message: "" };

/** White enquiry popup over a blurred scene. Opened by `openEnquiry(product)` from any clickable product. */
export default function EnquiryDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Enquiry>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Enquiry, string>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [extra, setExtra] = useState<string | null>(null);
  const pending = useRef<{ product: string } | null>(null);
  const first = useRef<HTMLInputElement>(null),
    returnFocus = useRef<Element | null>(null),
    dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const show = (event: Event) => {
      const product = (event as CustomEvent).detail as string | null;
      if (product && pending.current && product !== pending.current.product) {
        // The earlier enquiry can finish sending while the visitor starts a different one.
        pending.current = null;
        setStatus("idle");
      }
      returnFocus.current = document.activeElement;
      if (product && !ENQUIRY_PRODUCTS.includes(product)) setExtra(product);
      setForm((old) => ({ ...old, product: product ?? old.product }));
      setErrors({});
      setStatus((old) => (old === "sent" ? "idle" : old));
      setOpen(true);
    };
    window.addEventListener("product-enquiry", show);
    return () => {
      pending.current = null;
      window.removeEventListener("product-enquiry", show);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => first.current?.focus({ preventScroll: true }));
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      // Keep keyboard focus inside the popup.
      const items = [
        ...dialog.current.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea"),
      ].filter((e) => !e.hasAttribute("disabled") && e.tabIndex >= 0);
      const a = items[0],
        b = items[items.length - 1];
      if (event.shiftKey && document.activeElement === a) {
        event.preventDefault();
        b?.focus();
      } else if (!event.shiftKey && document.activeElement === b) {
        event.preventDefault();
        a?.focus();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key, true);
      (returnFocus.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const field = (key: keyof Enquiry) => ({
    id: `enquiry-${key}`,
    name: key,
    value: form[key],
    maxLength: ENQUIRY_LIMITS[key],
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `enquiry-${key}-error` : undefined,
    onChange: (event: { target: { value: string } }) => {
      const value = event.target.value;
      setForm((old) => ({ ...old, [key]: value }));
      if (errors[key]) setErrors((old) => ({ ...old, [key]: undefined }));
    },
  });
  const error = (key: keyof Enquiry) =>
    errors[key] ? (
      <span className="enquiry__error" id={`enquiry-${key}-error`}>
        {errors[key]}
      </span>
    ) : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    const honeypot = (event.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value;
    const { errors: found, enquiry } = validateEnquiry(form);
    setErrors(found);
    if (Object.keys(found).length) {
      (event.currentTarget.querySelector(`[name="${Object.keys(found)[0]}"]`) as HTMLElement | null)?.focus();
      return;
    }
    const request = { product: enquiry.product };
    pending.current = request;
    setStatus("sending");
    try {
      const response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...enquiry, website: honeypot }),
      });
      if (pending.current !== request) return;
      if (response.ok) {
        setStatus("sent");
        setForm((old) => ({ ...EMPTY, product: old.product }));
        return;
      }
      setStatus(response.status === 503 ? "offline" : "failed");
    } catch {
      if (pending.current === request) setStatus("failed");
    } finally {
      if (pending.current === request) pending.current = null;
    }
  };

  const products = extra ? [extra, ...ENQUIRY_PRODUCTS] : ENQUIRY_PRODUCTS;
  return (
    <div
      className={`enquiry${open ? " is-open" : ""}`}
      aria-hidden={!open}
      inert={!open}
      data-cinema-controls
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        ref={dialog}
        className="enquiry__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="enquiry-title"
      >
        <button type="button" className="enquiry__close" aria-label="Close" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <p className="enquiry__eyebrow">Product enquiry</p>
        <h2 id="enquiry-title" className="enquiry__title">
          {status === "sent" ? "Thank you." : "Tell us about your theatre."}
        </h2>
        {status === "sent" ? (
          <p className="enquiry__lead">Your message is on its way. We will reply by email or phone soon.</p>
        ) : (
          <form className="enquiry__form" noValidate onSubmit={submit}>
            <label className="enquiry__field">
              <span>Name</span>
              <input {...field("name")} ref={first} autoComplete="name" required />
              {error("name")}
            </label>
            <div className="enquiry__row">
              <label className="enquiry__field">
                <span>Email</span>
                <input {...field("email")} type="email" inputMode="email" autoComplete="email" required />
                {error("email")}
              </label>
              <label className="enquiry__field">
                <span>Mobile</span>
                <input {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" required />
                {error("phone")}
              </label>
            </div>
            <label className="enquiry__field">
              <span>Product</span>
              <select {...field("product")} required>
                <option value="" disabled>
                  Choose a product
                </option>
                {products.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {error("product")}
            </label>
            <label className="enquiry__field">
              <span>Message</span>
              <textarea
                {...field("message")}
                rows={3}
                placeholder="Screen size, seats, timeline — anything that helps."
              />
              {error("message")}
            </label>
            <input
              className="enquiry__trap"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <button type="submit" className="enquiry__send" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send enquiry"}
            </button>
            {status === "offline" && (
              <p className="enquiry__note" role="alert">
                Online sending is not switched on yet. Please email or WhatsApp us below.
              </p>
            )}
            {status === "failed" && (
              <p className="enquiry__note" role="alert">
                Something went wrong. Please try again, or email or WhatsApp us below.
              </p>
            )}
          </form>
        )}
        <div className="enquiry__or">
          <span>or reach us directly</span>
        </div>
        <ContactLinks className="enquiry__links" />
      </div>
    </div>
  );
}
