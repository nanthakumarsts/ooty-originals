import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HandHeart, Leaf, Sprout } from 'lucide-react';
import api from '../lib/api';
import { useShop } from '../context/ShopContext';
import Reveal from '../components/Reveal';
import TextReveal from '../components/TextReveal';
import { usePageTitle } from '../components/ui';
import { TextSkeleton } from '../components/Skeletons';

// The three values and the tagline are edited in Admin → Site settings; the story text in Admin → Pages.
const VALUE_ICONS = [Leaf, HandHeart, Sprout];

export default function About() {
  usePageTitle('Our story');
  const [page, setPage] = useState(null);
  const { settings } = useShop();
  const values = settings.about_values || [];

  useEffect(() => {
    api.get('/content/pages/about').then((d) => setPage(d.page)).catch(() => setPage({ title: 'Our Story', content: '' }));
  }, []);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-900">
        <img src="/images/hero-estate.webp" alt="" className="absolute inset-0 -z-10 size-full animate-hero-zoom object-cover object-[center_45%]" />
        <div className="absolute inset-0 -z-10 bg-brand-900/65" />
        <div className="container-page py-24 text-center text-white sm:py-32">
          <p className="mb-4 animate-rise text-xs font-semibold tracking-[0.2em] text-brand-200 uppercase">About Sannara</p>
          <TextReveal as="h1" immediate delay={150} text={page?.title || 'Our Story'} className="mx-auto max-w-3xl text-4xl leading-tight font-medium text-white sm:text-6xl" />
          <p className="mx-auto mt-5 max-w-xl animate-rise text-lg text-white/85" style={{ animationDelay: '240ms' }}>{settings.about_tagline}</p>
        </div>
      </section>

      <section className="container-page grid gap-12 py-16 lg:grid-cols-[1fr_380px] lg:gap-20 lg:py-24">
        {page ? <Reveal as="article" className="rich max-w-2xl text-[17px]" dangerouslySetInnerHTML={{ __html: page.content }} /> : <TextSkeleton />}
        <Reveal as="aside" delay={150}>
          <img src="/images/story-tea.webp" alt="A cup of Nilgiri masala tea" loading="lazy" className="aspect-[4/5] w-full rounded-3xl object-cover lg:sticky lg:top-28" />
        </Reveal>
      </section>

      <section className="border-y border-sand-200 bg-white">
        <div className="container-page py-16 lg:py-20">
          <p className="eyebrow mb-3 text-center">What we stand for</p>
          <TextReveal as="h2" text="Grown with integrity, packed with honesty" className="section-title text-center" />
          <ul className="mt-12 grid gap-8 md:grid-cols-3">
            {values.map(({ title, text }, i) => {
              const Icon = VALUE_ICONS[i % VALUE_ICONS.length];
              return (
              <Reveal as="li" key={title} delay={i * 120} className="text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Icon className="size-6" strokeWidth={1.6} aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-medium">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-ink-500">{text}</p>
              </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="container-page py-16 text-center lg:py-24">
        <TextReveal as="h2" text="Taste the Nilgiris for yourself" className="section-title" />
        <Link to="/shop" className="btn btn-primary btn-lg mt-7">
          Shop the collection <ArrowRight className="size-[18px]" aria-hidden />
        </Link>
      </section>
    </>
  );
}
