import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Layers, Sparkles, Image as ImageIcon } from 'lucide-react';
import api from '../lib/api';
import { img } from '../lib/format';
import { useApp } from '../context/AppContext';
import ImageUploader from '../components/ImageUploader';
import { Alert, Button, Field, PageHeader, PageSkeleton, usePageTitle } from '../components/ui';

const MAX_BANNERS = 8;
const EMPTY_BANNER = {
  image: '',
  eyebrow: '',
  title: '',
  subtitle: '',
  button_label: 'Shop the collection',
  button_link: '/shop',
  showcase_image: '',
  showcase_badge: '',
  showcase_category: '',
  showcase_title: '',
  showcase_rating: '4.9',
  showcase_price: '',
  showcase_link: '/shop',
};

const DEFAULT_PROMO_CARDS = [
  {
    eyebrow: 'ON THIS WEEK',
    title: 'ESTATE FRESH',
    title_highlight: 'NILGIRI TEAS',
    subtitle: 'Limits Time Offer',
    button_label: 'ORDER NOW',
    button_link: '/shop?category=nilgiri-teas',
    badge_text: '100%',
    badge_subtext: 'PURE',
    image: '/uploads/products/nilgiri-black-tea-150g-1.webp',
  },
  {
    eyebrow: 'WELCOME OOTY',
    title: 'ARTISANAL',
    title_highlight: 'CHOCOLATES',
    subtitle: 'Limits Time Offer',
    button_label: 'ORDER NOW',
    button_link: '/shop?category=homemade-chocolates',
    badge_text: '15%',
    badge_subtext: 'OFF',
    image: '/uploads/products/assorted-homemade-chocolates-1.webp',
  },
  {
    eyebrow: 'ON THIS WEEK',
    title: 'PURE NILGIRI',
    title_highlight: 'ESSENTIAL OILS',
    subtitle: 'Limits Time Offer',
    button_label: 'ORDER NOW',
    button_link: '/shop?category=essential-oils',
    badge_text: 'TOP',
    badge_subtext: 'SELLER',
    image: '/uploads/products/eucalyptus-oil-1.webp',
  },
];

const EMPTY_PROMO_CARD = {
  eyebrow: 'ON THIS WEEK',
  title: 'NEW OFFER',
  title_highlight: '',
  subtitle: 'Limits Time Offer',
  button_label: 'ORDER NOW',
  button_link: '/shop',
  badge_text: '',
  badge_subtext: '',
  image: '',
};

const DEFAULT_PROMO_BANNER = {
  eyebrow: 'WELCOME OOTY ORIGINALS',
  title: 'TODAY SPECIAL',
  title_highlight: 'TEA TIME HAMPER',
  subtitle: 'Limits Time Offer · 5 Rare Nilgiri Treasures',
  text: 'Experience Nilgiri Cardamom Tea, Fresh Roasted Coffee, Crisp Varkey, Wheat Biscuits & Rich Artisanal Chocolates.',
  button_label: 'ORDER NOW',
  button_link: '/product/ooty-s-finest-five-tea-time-hamper',
  price: '₹999',
  compare_price: '₹1,360',
  badge_text: '27% Off',
  image: '/uploads/products/ooty-s-finest-five-tea-time-hamper-1.webp',
};

const EMPTY_PROMO_BANNER = {
  eyebrow: 'WELCOME OOTY ORIGINALS',
  title: 'TODAY SPECIAL',
  title_highlight: '',
  subtitle: 'Limits Time Offer',
  text: 'Handcrafted fresh Nilgiri products packed fresh in Ooty.',
  button_label: 'ORDER NOW',
  button_link: '/shop',
  price: '',
  compare_price: '',
  badge_text: '',
  image: '',
};

let nextId = 0;
const tagged = (item) => ({ ...item, _id: ++nextId });

function startingBanners(settings) {
  if (settings.hero_slides?.length) return settings.hero_slides.map((b) => tagged({ ...EMPTY_BANNER, ...b }));
  return [tagged({ ...EMPTY_BANNER, image: settings.hero_image || '', eyebrow: settings.hero_eyebrow || '', title: settings.hero_title || '', subtitle: settings.hero_subtitle || '' })];
}

function linkChoices(categories, products = []) {
  const top = categories.filter((c) => !c.parent_id);
  const categoryLinks = top.flatMap((c) => [
    { value: `/shop?category=${c.slug}`, label: c.name },
    ...categories.filter((s) => s.parent_id === c.id).map((s) => ({ value: `/shop?category=${c.slug}&sub=${s.slug}`, label: `${c.name} › ${s.name}` })),
  ]);
  const productLinks = (products || []).map((p) => ({
    value: `/product/${p.slug}`,
    label: `${p.name}${p.price ? ` (₹${Number(p.price).toLocaleString('en-IN')})` : ''}`,
  }));

  return [
    {
      group: 'Direct Products (Link directly to product page)',
      items: productLinks,
    },
    { group: 'Categories', items: categoryLinks },
    {
      group: 'Shop General',
      items: [
        { value: '/shop', label: 'All products' },
        { value: '/shop?tag=bestseller', label: 'Best sellers' },
        { value: '/shop?sort=latest', label: 'New arrivals' },
        { value: '/shop?tag=sale', label: 'Products on offer' },
      ],
    },
    {
      group: 'Pages',
      items: [
        { value: '/about', label: 'Our story' },
        { value: '/contact', label: 'Contact us' },
      ],
    },
  ].filter((g) => g.items.length);
}

const CUSTOM = '__custom__';

function LinkPicker({ id, value, onChange, choices, label = 'When the button is pressed, open' }) {
  const known = choices.some((g) => g.items.some((o) => o.value === value));
  const [custom, setCustom] = useState(!known && value !== '');
  const typing = custom || (!known && value !== '');
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="label">{label}</label>
      <select
        id={id}
        value={typing ? CUSTOM : value || '/shop'}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(true);
            onChange('');
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
        className="input"
      >
        {choices.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        ))}
        <optgroup label="Something else">
          <option value={CUSTOM}>Another link (type it)…</option>
        </optgroup>
      </select>
      {typing ? (
        <Field
          className="mt-3"
          label="Link"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/product/nilgiri-green-tea-150g"
          hint="For one product: enter /product/your-product-slug. For an external website, start with https://"
        />
      ) : (
        <p className="mt-1.5 text-[13px] text-ink-500">Shoppers go to <span className="font-medium text-ink-700">{choices.flatMap((g) => g.items).find((o) => o.value === (value || '/shop'))?.label}</span> on the store.</p>
      )}
    </div>
  );
}

function Preview({ banner }) {
  return (
    <div className="relative flex aspect-[16/7] items-center overflow-hidden rounded-xl border border-line bg-[#f6f3ec] text-ink-900">
      <img
        src={banner.image ? img(banner.image) : '/images/hero-estate.webp'}
        alt=""
        className="absolute inset-0 size-full object-cover object-center"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#f6f3ec]/92 via-[#f6f3ec]/72 to-[#f6f3ec]/10" aria-hidden />
      <div className="relative z-10 max-w-[75%] px-5 py-3">
        <p className="line-clamp-2 text-sm leading-tight font-bold">{banner.title || 'Headline'}</p>
        {banner.subtitle && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-700">{banner.subtitle}</p>}
        {banner.button_label && <span className="mt-2.5 inline-block w-fit rounded-full bg-brand-600 px-3 py-1 text-[10px] font-semibold text-white">{banner.button_label}</span>}
      </div>
      {!banner.image && <span className="absolute right-2 bottom-2 z-10 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">Default photo</span>}
    </div>
  );
}

export default function Banners() {
  usePageTitle('Home banners & promos');
  const { toast } = useApp();
  const [activeTab, setActiveTab] = useState('hero'); // 'hero' | 'cards' | 'banner'
  const [slides, setSlides] = useState(null);
  const [promoCards, setPromoCards] = useState([]);
  const [promoBanners, setPromoBanners] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get('/settings')
      .then((d) => {
        setSlides(startingBanners(d.settings));
        if (d.settings.promo_cards && d.settings.promo_cards.length) {
          setPromoCards(d.settings.promo_cards.map(tagged));
        } else {
          setPromoCards(DEFAULT_PROMO_CARDS.map(tagged));
        }
        if (d.settings.promo_banners && d.settings.promo_banners.length) {
          setPromoBanners(d.settings.promo_banners.map(tagged));
        } else if (d.settings.promo_banner) {
          setPromoBanners([tagged(d.settings.promo_banner)]);
        } else {
          setPromoBanners([tagged(DEFAULT_PROMO_BANNER)]);
        }
      })
      .catch((err) => toast.error(err.message));

    api.get('/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {});

    api.get('/products?limit=150')
      .then((d) => setProducts(d.items || []))
      .catch(() => {});
  }, [toast]);

  const choices = useMemo(() => linkChoices(categories, products), [categories, products]);

  if (!slides) return <PageSkeleton />;

  // Slide helpers
  const updateSlide = (index, key, value) => setSlides((rows) => rows.map((b, i) => (i === index ? { ...b, [key]: value } : b)));
  const moveSlide = (index, step) =>
    setSlides((rows) => {
      const next = [...rows];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  const addSlide = () => setSlides((rows) => [...rows, tagged({ ...EMPTY_BANNER })]);
  const deleteSlide = (index) => setSlides((rows) => rows.filter((_, idx) => idx !== index));
  const fullSlides = slides.length >= MAX_BANNERS;

  // Card helpers
  const addCard = () => setPromoCards((rows) => [...rows, tagged({ ...EMPTY_PROMO_CARD })]);
  const deleteCard = (index) => setPromoCards((rows) => rows.filter((_, idx) => idx !== index));
  const moveCard = (index, step) =>
    setPromoCards((rows) => {
      const next = [...rows];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  const updateCard = (index, key, value) => {
    setPromoCards((rows) => rows.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  };

  // Banner helpers
  const addBanner = () => setPromoBanners((rows) => [...rows, tagged({ ...EMPTY_PROMO_BANNER })]);
  const deleteBanner = (index) => setPromoBanners((rows) => rows.filter((_, idx) => idx !== index));
  const moveBanner = (index, step) =>
    setPromoBanners((rows) => {
      const next = [...rows];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  const updateBannerField = (index, key, value) => {
    setPromoBanners((rows) => rows.map((b, i) => (i === index ? { ...b, [key]: value } : b)));
  };

  const submit = async (e) => {
    e.preventDefault();
    let problem = '';
    if (activeTab === 'hero') {
      if (!slides.length) problem = 'Add at least one hero banner.';
      else if (slides.some((b) => !b.title.trim())) problem = 'Every hero banner needs a headline.';
    } else if (activeTab === 'cards') {
      if (promoCards.some((c) => !c.title.trim())) problem = 'Every offer card needs a title.';
    } else if (activeTab === 'banner') {
      if (promoBanners.some((b) => !b.title.trim())) problem = 'Every promo banner needs a headline.';
    }
    setError(problem);
    if (problem) {
      toast.error(problem);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        hero_slides: slides.map((b) => ({
          image: b.image || '',
          eyebrow: (b.eyebrow || '').trim(),
          title: (b.title || '').trim(),
          subtitle: (b.subtitle || '').trim(),
          button_label: (b.button_label || '').trim(),
          button_link: (b.button_link || '').trim(),
          showcase_image: b.showcase_image || '',
          showcase_badge: (b.showcase_badge || '').trim(),
          showcase_category: (b.showcase_category || '').trim(),
          showcase_title: (b.showcase_title || '').trim(),
          showcase_rating: (b.showcase_rating || '').trim(),
          showcase_price: (b.showcase_price || '').trim(),
          showcase_link: (b.showcase_link || '').trim(),
        })),
        promo_cards: promoCards.map((c) => ({
          eyebrow: (c.eyebrow || '').trim(),
          title: (c.title || '').trim(),
          title_highlight: (c.title_highlight || '').trim(),
          subtitle: (c.subtitle || '').trim(),
          button_label: (c.button_label || '').trim(),
          button_link: (c.button_link || '').trim(),
          badge_text: (c.badge_text || '').trim(),
          badge_subtext: (c.badge_subtext || '').trim(),
          image: c.image || '',
        })),
        promo_banners: promoBanners.map((b) => ({
          eyebrow: (b.eyebrow || '').trim(),
          title: (b.title || '').trim(),
          title_highlight: (b.title_highlight || '').trim(),
          subtitle: (b.subtitle || '').trim(),
          text: (b.text || '').trim(),
          button_label: (b.button_label || '').trim(),
          button_link: (b.button_link || '').trim(),
          price: (b.price || '').trim(),
          compare_price: (b.compare_price || '').trim(),
          badge_text: (b.badge_text || '').trim(),
          image: b.image || '',
        })),
        promo_banner: promoBanners[0] ? {
          eyebrow: (promoBanners[0].eyebrow || '').trim(),
          title: (promoBanners[0].title || '').trim(),
          title_highlight: (promoBanners[0].title_highlight || '').trim(),
          subtitle: (promoBanners[0].subtitle || '').trim(),
          text: (promoBanners[0].text || '').trim(),
          button_label: (promoBanners[0].button_label || '').trim(),
          button_link: (promoBanners[0].button_link || '').trim(),
          price: (promoBanners[0].price || '').trim(),
          compare_price: (promoBanners[0].compare_price || '').trim(),
          badge_text: (promoBanners[0].badge_text || '').trim(),
          image: promoBanners[0].image || '',
        } : null,
      };

      const saved = (await api.put('/settings', payload)).settings;
      if (saved.hero_slides) setSlides(startingBanners(saved));
      if (saved.promo_cards) setPromoCards(saved.promo_cards.map(tagged));
      if (saved.promo_banners && saved.promo_banners.length) {
        setPromoBanners(saved.promo_banners.map(tagged));
      } else if (saved.promo_banner) {
        setPromoBanners([tagged(saved.promo_banner)]);
      }
      toast.success('Saved successfully — the home page is updated!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title="Home banners &amp; promos"
        description="Manage the Hero Carousel, Offer Cards (Taste of the Hills), and Panoramic Promo Banners."
      >
        <Button type="submit" loading={busy}>Save all changes</Button>
      </PageHeader>

      {error && <Alert className="mb-5">{error}</Alert>}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`flex items-center gap-2 rounded-t-lg border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === 'hero'
              ? 'border-brand-600 bg-brand-50/50 text-brand-700'
              : 'border-transparent text-ink-600 hover:bg-canvas-subtle hover:text-ink-900'
          }`}
        >
          <ImageIcon className="size-4" /> Top Hero Slider ({slides.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cards')}
          className={`flex items-center gap-2 rounded-t-lg border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === 'cards'
              ? 'border-brand-600 bg-brand-50/50 text-brand-700'
              : 'border-transparent text-ink-600 hover:bg-canvas-subtle hover:text-ink-900'
          }`}
        >
          <Layers className="size-4" /> Offer Cards ({promoCards.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          className={`flex items-center gap-2 rounded-t-lg border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === 'banner'
              ? 'border-brand-600 bg-brand-50/50 text-brand-700'
              : 'border-transparent text-ink-600 hover:bg-canvas-subtle hover:text-ink-900'
          }`}
        >
          <Sparkles className="size-4" /> Panoramic Promo Banners ({promoBanners.length})
        </button>
      </div>

      {/* TAB 1: HERO SLIDES */}
      {activeTab === 'hero' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-600">The sliding hero banners at the top of the storefront.</p>
            <Button variant="outline" type="button" onClick={addSlide} disabled={fullSlides}>
              <Plus className="size-4" aria-hidden /> Add slide
            </Button>
          </div>

          {slides.map((banner, i) => (
            <section key={banner._id} className="card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="card-title">Slide {i + 1}{i === 0 && <span className="ml-2 text-[13px] font-normal text-ink-500">shown first</span>}</h2>
                <div className="flex gap-0.5">
                  <button type="button" onClick={() => moveSlide(i, -1)} disabled={i === 0} className="icon-btn disabled:opacity-30" title="Move up"><ArrowUp className="size-4" /></button>
                  <button type="button" onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1} className="icon-btn disabled:opacity-30" title="Move down"><ArrowDown className="size-4" /></button>
                  <button type="button" onClick={() => deleteSlide(i)} disabled={slides.length === 1} className="icon-btn hover:bg-clay-50 hover:text-clay-600 disabled:opacity-30" title="Remove"><Trash2 className="size-4" /></button>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <div className="space-y-4">
                  <div>
                    <span className="label">Preview</span>
                    <Preview banner={banner} />
                  </div>
                  <div>
                    <span className="label">Banner Photo</span>
                    <ImageUploader max={1} folder="content" square value={banner.image ? [banner.image] : []} onChange={(urls) => updateSlide(i, 'image', urls[0] || '')} />
                    <p className="mt-1.5 text-[12px] text-ink-400">Full-width background photo. Leave empty for default tea estate photo.</p>
                  </div>
                </div>

                <div className="grid content-start gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2" label="Headline" required value={banner.title} onChange={(e) => updateSlide(i, 'title', e.target.value)} maxLength={120} />
                  <Field className="sm:col-span-2" label="Short subtitle" as="textarea" rows={2} value={banner.subtitle} onChange={(e) => updateSlide(i, 'subtitle', e.target.value)} maxLength={300} />
                  <Field className="sm:col-span-2" label="Button text" value={banner.button_label} onChange={(e) => updateSlide(i, 'button_label', e.target.value)} maxLength={40} />
                  <LinkPicker id={`banner-link-${banner._id}`} value={banner.button_link} onChange={(link) => updateSlide(i, 'button_link', link)} choices={choices} />
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* TAB 2: OFFER CARDS (A TASTE OF THE HILLS) */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-ink-900">Offer Cards (Taste of the Hills)</h2>
              <p className="text-sm text-ink-600">
                Manage promotional cards on the home page. You can add extra cards, delete unwanted cards, or reorder them.
              </p>
            </div>
            <Button variant="outline" type="button" onClick={addCard} disabled={promoCards.length >= 12}>
              <Plus className="size-4" aria-hidden /> Add card
            </Button>
          </div>

          {promoCards.length === 0 ? (
            <div className="card p-12 text-center">
              <Layers className="mx-auto size-10 text-ink-400 mb-3" />
              <p className="text-ink-600 font-medium">No offer cards added yet.</p>
              <Button type="button" variant="outline" onClick={addCard} className="mt-4">
                <Plus className="size-4" /> Add first card
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {promoCards.map((card, idx) => (
                <section key={card._id || idx} className="card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <h3 className="card-title">Card {idx + 1}</h3>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => moveCard(idx, -1)} disabled={idx === 0} className="icon-btn disabled:opacity-30" title="Move up"><ArrowUp className="size-4" /></button>
                      <button type="button" onClick={() => moveCard(idx, 1)} disabled={idx === promoCards.length - 1} className="icon-btn disabled:opacity-30" title="Move down"><ArrowDown className="size-4" /></button>
                      <button type="button" onClick={() => deleteCard(idx)} className="icon-btn hover:bg-clay-50 hover:text-clay-600" title="Delete card"><Trash2 className="size-4" /></button>
                    </div>
                  </div>

                  <div>
                    <span className="label">Product Photo</span>
                    <ImageUploader max={1} folder="products" square value={card.image ? [card.image] : []} onChange={(urls) => updateCard(idx, 'image', urls[0] || '')} />
                    <p className="mt-1 text-[11px] text-ink-400">Shown in floating card and atmospheric background.</p>
                  </div>

                  <Field label="Top Label (Eyebrow)" value={card.eyebrow} onChange={(e) => updateCard(idx, 'eyebrow', e.target.value)} placeholder="ON THIS WEEK" />
                  <Field label="Headline Title" required value={card.title} onChange={(e) => updateCard(idx, 'title', e.target.value)} placeholder="ESTATE FRESH" />
                  <Field label="Headline Line 2" value={card.title_highlight} onChange={(e) => updateCard(idx, 'title_highlight', e.target.value)} placeholder="NILGIRI TEAS" />
                  <Field label="Subtitle" value={card.subtitle} onChange={(e) => updateCard(idx, 'subtitle', e.target.value)} placeholder="Limits Time Offer" />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Badge Top" value={card.badge_text} onChange={(e) => updateCard(idx, 'badge_text', e.target.value)} placeholder="100%" />
                    <Field label="Badge Subtext" value={card.badge_subtext} onChange={(e) => updateCard(idx, 'badge_subtext', e.target.value)} placeholder="PURE" />
                  </div>

                  <Field label="Button text" value={card.button_label} onChange={(e) => updateCard(idx, 'button_label', e.target.value)} placeholder="ORDER NOW" />
                  <LinkPicker id={`card-link-${card._id || idx}`} value={card.button_link} onChange={(link) => updateCard(idx, 'button_link', link)} choices={choices} label="Button destination" />
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PANORAMIC PROMO BANNERS (TODAY SPECIAL) */}
      {activeTab === 'banner' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-ink-900">Panoramic Promo Banners</h2>
              <p className="text-sm text-ink-600">The wide spotlight offer banners displayed directly above the "New arrivals" row.</p>
            </div>
            <Button variant="outline" type="button" onClick={addBanner} disabled={promoBanners.length >= 6}>
              <Plus className="size-4" aria-hidden /> Add promo banner
            </Button>
          </div>

          {promoBanners.length === 0 ? (
            <div className="card p-12 text-center">
              <Sparkles className="mx-auto size-10 text-ink-400 mb-3" />
              <p className="text-ink-600 font-medium">No panoramic banners added.</p>
              <Button type="button" variant="outline" onClick={addBanner} className="mt-4">
                <Plus className="size-4" /> Add promo banner
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {promoBanners.map((banner, idx) => (
                <section key={banner._id || idx} className="card p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                      <h3 className="card-title">Promo Banner {idx + 1}</h3>
                      <p className="text-xs text-ink-500">Wide spotlight banner</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => moveBanner(idx, -1)} disabled={idx === 0} className="icon-btn disabled:opacity-30" title="Move up"><ArrowUp className="size-4" /></button>
                      <button type="button" onClick={() => moveBanner(idx, 1)} disabled={idx === promoBanners.length - 1} className="icon-btn disabled:opacity-30" title="Move down"><ArrowDown className="size-4" /></button>
                      <button type="button" onClick={() => deleteBanner(idx)} className="icon-btn hover:bg-clay-50 hover:text-clay-600" title="Delete banner"><Trash2 className="size-4" /></button>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <span className="label">Banner Photo</span>
                        <ImageUploader max={1} folder="products" square value={banner.image ? [banner.image] : []} onChange={(urls) => updateBannerField(idx, 'image', urls[0] || '')} />
                        <p className="mt-1 text-[12px] text-ink-400">Used for the featured box and atmospheric blurred background.</p>
                      </div>

                      <Field label="Top Eyebrow" value={banner.eyebrow} onChange={(e) => updateBannerField(idx, 'eyebrow', e.target.value)} placeholder="WELCOME OOTY ORIGINALS" />
                      <Field label="Main Headline" required value={banner.title} onChange={(e) => updateBannerField(idx, 'title', e.target.value)} placeholder="TODAY SPECIAL" />
                      <Field label="Headline Highlight" value={banner.title_highlight} onChange={(e) => updateBannerField(idx, 'title_highlight', e.target.value)} placeholder="TEA TIME HAMPER" />
                      <Field label="Subheading" value={banner.subtitle} onChange={(e) => updateBannerField(idx, 'subtitle', e.target.value)} placeholder="Limits Time Offer · 5 Rare Nilgiri Treasures" />
                    </div>

                    <div className="space-y-4">
                      <Field label="Description Text" as="textarea" rows={3} value={banner.text} onChange={(e) => updateBannerField(idx, 'text', e.target.value)} placeholder="Experience Nilgiri Cardamom Tea, Fresh Roasted Coffee..." />
                      
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Badge" value={banner.badge_text} onChange={(e) => updateBannerField(idx, 'badge_text', e.target.value)} placeholder="27% Off" />
                        <Field label="Discount Price" value={banner.price} onChange={(e) => updateBannerField(idx, 'price', e.target.value)} placeholder="₹999" />
                        <Field label="Original Price" value={banner.compare_price} onChange={(e) => updateBannerField(idx, 'compare_price', e.target.value)} placeholder="₹1,360" />
                      </div>

                      <Field label="Button text" value={banner.button_label} onChange={(e) => updateBannerField(idx, 'button_label', e.target.value)} placeholder="ORDER NOW" />
                      <LinkPicker id={`promo-banner-link-${banner._id || idx}`} value={banner.button_link} onChange={(link) => updateBannerField(idx, 'button_link', link)} choices={choices} label="Button destination" />
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button type="submit" loading={busy} className="min-w-36">Save all changes</Button>
      </div>
    </form>
  );
}
