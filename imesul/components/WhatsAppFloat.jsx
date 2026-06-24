import Image from "next/image";

export default function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/556733125600"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a IMESUL no WhatsApp"
      className="group fixed bottom-5 right-5 z-[140] flex h-14 w-14 items-center justify-center rounded-full text-white transition duration-300 hover:-translate-y-1 hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25d366] motion-reduce:transform-none sm:bottom-7 sm:right-7 sm:h-16 sm:w-16"
    >
      <span
        className="absolute inset-1 rounded-full bg-[#25d366]/30 blur-xl opacity-70 transition-opacity duration-300 group-hover:opacity-100 motion-safe:animate-pulse"
        aria-hidden="true"
      />
      <span
        className="absolute inset-0 rounded-full border border-white/20 bg-gradient-to-br from-[#25332d] via-[#0a1510] to-[#020705] shadow-[0_15px_28px_rgba(0,0,0,0.42),0_7px_13px_rgba(0,0,0,0.34),inset_0_2px_1px_rgba(255,255,255,0.2),inset_0_-5px_10px_rgba(0,0,0,0.55)] transition-shadow duration-300 group-hover:shadow-[0_19px_36px_rgba(0,0,0,0.48),0_0_22px_rgba(37,211,102,0.3),inset_0_2px_1px_rgba(255,255,255,0.24),inset_0_-5px_10px_rgba(0,0,0,0.5)]"
        aria-hidden="true"
      />
      <span className="relative flex h-full w-full items-center justify-center" aria-hidden="true">
        <Image
          src="/icons/icone-do-whats.webp"
          alt=""
          width={64}
          height={64}
          sizes="(max-width: 640px) 56px, 64px"
          unoptimized
          priority
          className="block h-[76%] w-[76%] object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.06]"
        />
      </span>
    </a>
  );
}
