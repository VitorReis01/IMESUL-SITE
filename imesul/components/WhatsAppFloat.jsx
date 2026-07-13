// Mantem o contato comercial acessivel e aplica profundidade ao botao, nao ao icone.
export default function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/556733125600"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a IMESUL no WhatsApp"
      className="group fixed bottom-5 right-5 z-[140] flex h-14 w-14 items-center justify-center rounded-full text-[#25d366] transition-transform duration-300 ease-out hover:-translate-y-1 hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25d366] motion-reduce:transform-none sm:bottom-7 sm:right-7 sm:h-16 sm:w-16"
    >
      <span
        className="whatsapp-float-halo pointer-events-none absolute -inset-1 rounded-full border border-[#25d366]/15 bg-[#25d366]/10 blur-[7px] transition duration-300 group-hover:border-[#25d366]/25 group-hover:bg-[#25d366]/15 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-0 rounded-full border border-white/15 bg-[radial-gradient(circle_at_35%_25%,rgba(46,77,62,0.92)_0%,rgba(10,22,16,0.98)_43%,rgba(2,7,5,1)_100%)] shadow-[0_14px_26px_rgba(0,0,0,0.45),0_0_14px_rgba(37,211,102,0.12),inset_0_1px_1px_rgba(255,255,255,0.16),inset_0_-5px_10px_rgba(0,0,0,0.58)] transition-shadow duration-300 group-hover:shadow-[0_18px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(37,211,102,0.22),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-5px_10px_rgba(0,0,0,0.52)]"
        aria-hidden="true"
      />
      <svg
        viewBox="0 0 24 24"
        className="relative h-[56%] w-[56%]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M20.5 11.6a8.5 8.5 0 0 1-12.55 7.47L3.5 20.5l1.45-4.28A8.5 8.5 0 1 1 20.5 11.6Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.25 7.75c.3-.3.78-.31 1.05-.03l1.06 1.1c.24.25.28.63.1.93l-.62 1.03c.7 1.45 1.84 2.57 3.3 3.24l.98-.62c.3-.19.7-.16.95.09l1.1 1.06c.3.28.28.77-.02 1.07l-.56.55c-.58.58-1.45.78-2.22.5-3.1-1.1-5.45-3.42-6.57-6.5-.28-.77-.1-1.63.49-2.22l.51-.5Z"
          fill="currentColor"
        />
      </svg>
    </a>
  );
}
