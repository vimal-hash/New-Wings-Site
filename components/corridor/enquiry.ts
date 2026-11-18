/** Shared rules for the product enquiry form (browser and server). */
export type Enquiry = { name: string; email: string; phone: string; product: string; message: string };

export const ENQUIRY_LIMITS = { name: 80, email: 120, phone: 24, product: 120, message: 2000 } as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Returns one message per invalid field (empty when the enquiry is valid). */
export function validateEnquiry(value: Partial<Record<keyof Enquiry, unknown>>) {
  const text = (key: keyof Enquiry) => (typeof value[key] === "string" ? (value[key] as string).trim() : "");
  const errors: Partial<Record<keyof Enquiry, string>> = {};
  const name = text("name"),
    email = text("email"),
    phone = text("phone"),
    product = text("product"),
    message = text("message");
  if (!name) errors.name = "Please enter your name.";
  if (!EMAIL.test(email)) errors.email = "Please enter a valid email address.";
  const digits = phone.replace(/\D/g, "");
  if (!/^[+\d\s()-]*$/.test(phone) || digits.length < 7 || digits.length > 15)
    errors.phone = "Please enter a valid mobile number.";
  if (!product) errors.product = "Please choose a product.";
  for (const key of Object.keys(ENQUIRY_LIMITS) as (keyof Enquiry)[])
    if (text(key).length > ENQUIRY_LIMITS[key]) errors[key] = "This is too long.";
  return { errors, enquiry: { name, email, phone, product, message } as Enquiry };
}

/** Opens the enquiry popup for a product (any product name; the list adds unknown names). */
export function openEnquiry(product: string | null) {
  window.dispatchEvent(new CustomEvent("product-enquiry", { detail: product }));
}
