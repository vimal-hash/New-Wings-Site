/**
 * Contact details shown across the site. PLACEHOLDERS: replace with the client's real details.
 * `email` also receives enquiry-form messages once the mail service key is set (see app/api/enquiry/route.ts).
 */
export const SITE_CONTACT = {
  email: "hello@example.com", // PLACEHOLDER
  whatsapp: "910000000000", // PLACEHOLDER: country code + number, digits only
  linkedin: "", // PLACEHOLDER: full LinkedIn company page URL
} as const;

export const contactLinks = {
  mail: `mailto:${SITE_CONTACT.email}`,
  whatsapp: `https://wa.me/${SITE_CONTACT.whatsapp}`,
  linkedin: SITE_CONTACT.linkedin || "#",
};
