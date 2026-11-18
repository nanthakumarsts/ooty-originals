/**
 * Default site content. Everything here can be edited later from the admin panel
 * (Content → Site settings / Pages), so treat it as a starting point.
 */

const ADDRESS = 'Sannara, Herdsmen Business Ventures Pvt. Ltd., 10, YBA Building, Church Hill Road, Ooty, The Nilgiris, Tamil Nadu – 643001';

const faqs = [
  { q: 'Where do you source your products from?', a: 'Directly from local farmers and producers in the Nilgiri Hills. Our sourcing supports the livelihoods of small growers and makers, and every product reflects the craft of the local community.' },
  { q: 'How long does delivery take?', a: 'Within Tamil Nadu we aim to deliver the next day or within 2 days. For other states in India, orders usually arrive in 3–7 business days. You will receive tracking details as soon as your order ships.' },
  { q: 'How do you keep products fresh during delivery?', a: 'We pack every order in Ooty using protective, food-safe packaging that shields it from temperature changes and damage in transit, and we ship with reliable courier partners that prioritise timely delivery.' },
  { q: 'What payment methods do you accept?', a: 'Credit and debit cards, net banking, UPI and popular wallets — all processed securely through Razorpay. Cash on Delivery is available on eligible orders.' },
  { q: 'How can I track my order?', a: 'Open My Orders in your account to see the live status of every order. Once shipped, the courier name and tracking number appear there and are emailed to you.' },
  { q: 'What is your return policy?', a: 'You can return products within 14 days of receipt. Items must be unused, in their original packaging and in the condition you received them. Contact our support team with your order number to start a return.' },
  { q: 'Do you offer refunds?', a: 'Yes. Once we receive and inspect a returned product, the refund is issued to your original payment method, usually within 7 business days. Shipping charges are non-refundable.' },
  { q: 'What if I receive a damaged product?', a: 'Please contact us right away with your order number and a photo of the item. We will arrange a replacement or a refund, whichever you prefer.' },
  { q: 'Do you ship internationally?', a: 'Not yet — we currently deliver across India only. International shipping is something we are working on.' },
  { q: 'How can I contact customer support?', a: 'Email hi@ootyoriginals.in or message us on WhatsApp at +91 94876 54990. We are available Monday to Friday 9 am – 8 pm and Saturday 11 am – 3 pm.' },
];

const settings = {
  announcement: 'Use code EASY10 for 10% off on orders above ₹1,200',
  hero_eyebrow: 'Authentic Nilgiri Products',
  hero_title: 'From the Nilgiri hills to your home',
  hero_subtitle: 'Estate-fresh teas, homemade chocolates, pure essential oils and classic Ooty varkey — sourced directly from local growers and makers, packed fresh in Ooty.',
  hero_image: '',
  contact_phone: '+91 94876 54990',
  contact_whatsapp: '919487654990',
  contact_email: 'hi@ootyoriginals.in',
  contact_address: ADDRESS,
  business_hours: 'Mon – Fri: 9:00 am – 8:00 pm · Sat: 11:00 am – 3:00 pm',
  social_facebook: 'https://www.facebook.com/ootyoriginals',
  social_instagram: 'https://www.instagram.com/ootyoriginals',
  social_youtube: 'https://www.youtube.com/@OotyOriginals',
  shipping_fee: '0',
  free_shipping_min: '0',
  cod_enabled: '1',
  footer_note: 'Authentic products from the Nilgiris, curated by people who call these hills home.',
  faqs: JSON.stringify(faqs),

  // Home page
  promises: JSON.stringify([
    { title: 'Sourced in the Nilgiris', text: 'Direct from local growers and makers' },
    { title: 'Packed fresh in Ooty', text: 'Small batches, sealed for freshness' },
    { title: 'Delivered across India', text: 'Tamil Nadu in 1–2 days' },
    { title: 'Secure payments', text: 'UPI, cards and net banking' },
  ]),
  story_title: 'Curated by people who call these hills home',
  story_text: 'We are a team of native people who came together to bring authentic, high-quality products from the Nilgiris to homes across the country.\n\nEvery product carries the soul of these hills — grown with integrity, packed with honesty and delivered with pride. Sannara was never just a business. It is a promise to protect and share the heritage of the Nilgiris.',
  story_stat: '1000s',
  story_stat_text: 'of small farmers and producers supported across the hills',

  // About page
  about_tagline: 'Bringing the authentic heritage of the Nilgiris to every Indian home.',
  about_values: JSON.stringify([
    { title: 'Authentic', text: 'Every product is sourced from the Nilgiris and curated by people who live here.' },
    { title: 'Fair to growers', text: 'Our sourcing supports the livelihood of thousands of small farmers and producers.' },
    { title: 'Responsible', text: 'We do business with care for our native place and keep quality intact, always.' },
  ]),

  // Product page
  delivery_short: 'Tamil Nadu in 1–2 days',
  returns_short: 'Within 14 days',
  delivery_info: 'Packed fresh and shipped from Ooty, The Nilgiris.\nTamil Nadu: next day or within 2 days. Rest of India: 3–7 business days.\nTracking details are shared by email and in My Orders once your order ships.',
  returns_info: 'Return within 14 days of delivery if the product is unused and in its original packaging.\nDamaged on arrival? Contact us with a photo and we will replace or refund it.',

  // Footer
  newsletter_title: 'Letters from the hills',
  newsletter_text: 'New harvests, offers and stories — a few times a month.',
};

const pages = [
  {
    slug: 'about',
    title: 'Our Story',
    content: `<h2>Rooted in the Nilgiris</h2>
<p>We are a team of native people who came together to curate authentic, high-quality products from the Nilgiris. We live here, and we want to bring the experience of healthy living from the Nilgiri Hills to homes across the country and beyond.</p>
<p>Our products are curated in a way that supports the livelihood of thousands of small farmers and producers around the hills. That is what sets us apart — and it is how we make sure you enjoy the true authenticity of Ooty.</p>
<p>We understand our duty towards our native place. We intend to do business responsibly and to keep quality intact, always.</p>
<h2>A promise, not just a business</h2>
<p>The Nilgiris gave us something the world deserves to experience. Every product we bring to you carries the soul of these magnificent hills — grown with integrity, packed with honesty and delivered with immense pride.</p>
<p>Sannara was never just a business. It was a promise to protect and share the authentic heritage of the Nilgiris with every Indian home.</p>
<h2>Founder’s message</h2>
<p>We at Sannara have grown steadily since our inception and remain committed to creating an enriching, healthy way of living for our customers while protecting the quality and authenticity that define who we are.</p>
<p>With Sannara you are not just buying products — you are supporting local farmers and producers while embracing a healthier lifestyle.</p>`,
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    content: `<p>This policy explains what information Sannara (Herdsmen Business Ventures Pvt. Ltd.) collects when you use our website, and how we use and protect it.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Account details</strong> — your name, email address, mobile number and password (stored only in encrypted form).</li>
<li><strong>Delivery details</strong> — the addresses you save for shipping your orders.</li>
<li><strong>Order details</strong> — the products you buy, order value, payment status and transaction reference.</li>
<li><strong>Messages</strong> — anything you send us through the contact form, email or WhatsApp.</li>
</ul>
<h2>How we use your information</h2>
<ul>
<li>To process, deliver and support your orders.</li>
<li>To send order, payment and account notifications by email.</li>
<li>To respond to your questions and requests.</li>
<li>To send offers and news, only if you subscribe to our newsletter.</li>
<li>To keep our website secure and prevent fraud.</li>
</ul>
<h2>Payments</h2>
<p>Online payments are processed by Razorpay. We never see or store your card number, UPI PIN or net-banking password. We only receive a transaction reference and the payment status.</p>
<h2>Sharing</h2>
<p>We share only what is necessary with our courier partners (name, address, phone) to deliver your order, and with our payment partner to process your payment. We do not sell your personal information.</p>
<h2>Cookies and local storage</h2>
<p>We use your browser’s local storage to keep you signed in and to remember your cart and compare list. We do not use advertising trackers.</p>
<h2>Your choices</h2>
<p>You can view and update your details and addresses any time from My Account. To delete your account or request a copy of your data, write to us at hi@ootyoriginals.in.</p>
<h2>Contact</h2>
<p>${ADDRESS}<br>Email: hi@ootyoriginals.in</p>`,
  },
  {
    slug: 'terms-and-conditions',
    title: 'Terms & Conditions',
    content: `<p>These terms apply to your use of the Sannara website and to every order placed through it. By using the website you agree to them.</p>
<h2>Products and pricing</h2>
<ul>
<li>All prices are in Indian Rupees and include GST.</li>
<li>We take care to describe and photograph products accurately. As many are natural or handmade, slight variations in colour, size and appearance are normal.</li>
<li>Prices and availability can change without notice. The price shown at checkout is the price you pay.</li>
</ul>
<h2>Orders</h2>
<ul>
<li>An order is confirmed once payment is received, or when a Cash on Delivery order is accepted.</li>
<li>We may cancel an order if a product is unavailable or if there is a pricing or payment error. Any amount paid is refunded in full.</li>
<li>You can cancel an order from My Orders any time before it has shipped.</li>
</ul>
<h2>Delivery</h2>
<p>We currently deliver across India. Delivery timelines are estimates and may vary with location, weather and courier conditions.</p>
<h2>Returns and refunds</h2>
<p>Returns and refunds are covered by our Refund &amp; Returns Policy.</p>
<h2>Your account</h2>
<p>You are responsible for keeping your password confidential and for activity on your account. Please tell us immediately if you suspect unauthorised use.</p>
<h2>Wellness products</h2>
<p>Essential oils and wellness products are for external use unless stated otherwise and are not a substitute for medical advice. Do a patch test before use and consult a doctor if you are pregnant, nursing or have a medical condition.</p>
<h2>Governing law</h2>
<p>These terms are governed by the laws of India. Disputes are subject to the courts of The Nilgiris, Tamil Nadu.</p>
<h2>Contact</h2>
<p>${ADDRESS}<br>Email: hi@ootyoriginals.in</p>`,
  },
  {
    slug: 'refund-policy',
    title: 'Refund & Returns Policy',
    content: `<p>We want you to be happy with your purchase. If something is not right, here is how we can help.</p>
<h2>Returns</h2>
<ul>
<li>You can return a product within 14 days of receiving it.</li>
<li>Items must be unused, in their original packaging and in the condition you received them.</li>
<li>Only regular-priced items can be refunded. Sale items cannot be refunded.</li>
</ul>
<h2>Damaged or defective items</h2>
<p>If your order arrives damaged or defective, contact us with your order number and a photo. We will replace the item or refund you, whichever you prefer.</p>
<h2>Refunds</h2>
<ul>
<li>Once your return is received and inspected, we will email you to confirm whether the refund is approved.</li>
<li>Approved refunds are issued to your original payment method, usually within 7 business days.</li>
<li>Shipping charges are non-refundable, and the cost of return shipping is borne by the customer.</li>
</ul>
<h2>Late or missing refunds</h2>
<p>If you have not received a refund yet, first check your bank account, then contact your card provider or bank — it can take some time for a refund to be posted. If you still need help, write to us.</p>
<h2>Where to send returns</h2>
<p>${ADDRESS}</p>
<p>We recommend a trackable shipping service for returns.</p>
<h2>Need help?</h2>
<p>Email hi@ootyoriginals.in or WhatsApp +91 94876 54990.</p>`,
  },
];

const categoryDescriptions = {
  'nilgiri-teas': 'High-grown estate teas with the bright, brisk character the Nilgiris are known for.',
  coffee: 'Rich, aromatic coffee from the hills — filter blends and instant.',
  'homemade-chocolates': 'Ooty’s famous homemade chocolates, made fresh in small batches.',
  'cookies-bakes': 'Crisp Ooty varkey and wheat biscuits, baked the traditional way.',
  'essential-oils': 'Pure, steam-distilled oils from the Nilgiri hills.',
  'nilgiri-jams': 'Fruit jams made from hill-grown produce.',
  honey: 'Raw forest honey gathered in the Nilgiris.',
  spices: 'Whole spices with full aroma — pepper, cardamom, cloves and cinnamon.',
  nuts: 'Premium nuts, carefully graded and freshly packed.',
  'dried-fruits': 'Naturally sweet dried fruits for everyday snacking.',
  'gift-hampers': 'Curated hampers that bring the best of Ooty together.',
  oils: 'Single-origin essential and carrier oils.',
  'roll-ons': 'Easy-to-carry roll-on blends.',
  sprays: 'Ready-to-use natural sprays.',
  'oil-combos': 'Value sets of our most-loved oils.',
};

module.exports = { settings, pages, categoryDescriptions };
