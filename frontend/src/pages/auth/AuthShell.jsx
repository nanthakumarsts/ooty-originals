/** Two-column frame shared by the sign-in, register and password pages. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container-page grid items-stretch gap-10 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center">
        <h1 className="text-4xl font-medium sm:text-[2.75rem]">{title}</h1>
        {subtitle && <p className="mt-3 text-lg text-ink-500">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <p className="mt-8 text-center text-[15px] text-ink-500">{footer}</p>}
      </div>
      <div className="relative hidden overflow-hidden rounded-3xl lg:block">
        <img src="/images/hero-estate.webp" alt="" className="absolute inset-0 size-full object-cover object-[center_60%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/20 to-transparent" />
        <blockquote className="absolute inset-x-10 bottom-10 text-white">
          <p className="font-display text-3xl leading-snug">“Every product carries the soul of these magnificent hills.”</p>
          <footer className="mt-4 text-sm tracking-wide text-white/80">Ooty Originals · The Nilgiris</footer>
        </blockquote>
      </div>
    </div>
  );
}
