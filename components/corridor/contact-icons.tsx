import { contactLinks, SITE_CONTACT } from "./site-contact";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...ICON}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>;
}
export function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...ICON}><path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.3 18.6Z" /><path d="M9.2 8.6c.3-.6.8-.6 1-.1l.6 1.4c.1.3 0 .6-.2.8l-.4.4c.5 1.1 1.4 2 2.6 2.6l.4-.4c.2-.2.5-.3.8-.2l1.4.6c.5.2.5.7-.1 1-.9.6-2 .7-3 .2a8 8 0 0 1-3.4-3.4c-.5-1-.4-2.1.3-2.9Z" /></svg>;
}
export function LinkedInIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...ICON}><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M8 10.5V16M8 7.8v.1M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16" /></svg>;
}

/** The three ways to reach the team, as icon links. Used by the bar and the enquiry popup. */
export function ContactLinks({ className }: { className?: string }) {
  const placeholder = !SITE_CONTACT.linkedin;
  return (
    <div className={className}>
      <a href={contactLinks.mail} aria-label={`Email ${SITE_CONTACT.email}`} title="Email"><MailIcon /></a>
      <a href={contactLinks.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp"><WhatsAppIcon /></a>
      <a href={contactLinks.linkedin} target={placeholder ? undefined : "_blank"} rel="noreferrer" aria-label="LinkedIn" title="LinkedIn"
        onClick={placeholder ? event => event.preventDefault() : undefined}><LinkedInIcon /></a>
    </div>
  );
}
