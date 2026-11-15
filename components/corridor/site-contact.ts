/**
 * Contact details shown across the site (client-confirmed 2026-11-15).
 * The enquiry form is separate: it sends only once the mail service key is set (see app/api/enquiry/route.ts).
 */
export const SITE_CONTACT = {
  email: "newwingssales@gmail.com",
  whatsapp: "919444546390", // country code + number, digits only
  linkedin: "https://in.linkedin.com/in/new-wings-solutions-n-w-s-35a02a287",
} as const;

export const contactLinks = {
  mail: `mailto:${SITE_CONTACT.email}`,
  whatsapp: `https://wa.me/${SITE_CONTACT.whatsapp}`,
  linkedin: SITE_CONTACT.linkedin || "#",
};
