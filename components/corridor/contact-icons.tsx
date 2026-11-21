import Image from "next/image";
import { contactLinks, SITE_CONTACT } from "./site-contact";

function ContactIcon({ brand }: { brand: "gmail" | "whatsapp" | "linkedin" }) {
  return <Image src={`/images/contact/${brand}.webp`} width={25} height={25} alt="" unoptimized />;
}

/** The three ways to reach the team, as icon links. Used by the bar and the enquiry popup. */
export function ContactLinks({ className }: { className?: string }) {
  const placeholder = !SITE_CONTACT.linkedin;
  return (
    <div className={className}>
      <a href={contactLinks.mail} aria-label={`Email ${SITE_CONTACT.email}`} title="Email">
        <ContactIcon brand="gmail" />
      </a>
      <a href={contactLinks.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp">
        <ContactIcon brand="whatsapp" />
      </a>
      <a
        href={contactLinks.linkedin}
        target={placeholder ? undefined : "_blank"}
        rel="noreferrer"
        aria-label="LinkedIn"
        title="LinkedIn"
        onClick={placeholder ? (event) => event.preventDefault() : undefined}
      >
        <ContactIcon brand="linkedin" />
      </a>
    </div>
  );
}
