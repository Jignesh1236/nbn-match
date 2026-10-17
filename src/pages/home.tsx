import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Film, Play, X } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { useLanguage, type Language } from '@/lib/language';
import { videoEntries, type VideoEntry } from '@/lib/video-data';
import { startLenis, stopLenis } from '@/hooks/use-lenis';

const copy = {
  bn: {
    nav: ['হোম', 'NBN সম্পর্কে', 'যেভাবে কাজ করে', 'ভিডিও'],
    mainNavigation: 'প্রধান নেভিগেশন',
    mobileNavigation: 'মোবাইল নেভিগেশন',
    openMenu: 'মেনু খুলুন',
    closeMenu: 'মেনু বন্ধ করুন',
    register: 'রেজিস্ট্রেশন করুন',
    brand: 'NBN Match Making Event',
    heroTitle: 'জীবনসঙ্গী খুঁজে নিন',
    heroAccent: 'বিশ্বাসের সাথে',
    heroDescription: 'আপনার মূল্যবোধ, পছন্দ ও ভবিষ্যৎ স্বপ্নের সাথে মানানসই জীবনসঙ্গী খুঁজে পাওয়ার যাত্রা শুরু হোক NBN-এর সাথে।',
    watchVideos: 'ভিডিও দেখুন',
    heroNoteTitle: 'একটি অর্থবহ শুরু',
    heroNote: 'আপনার মতো করেই, আপনার সময়ে।',
    heroAlt: 'বিয়ের সাজে এক দম্পতি একসঙ্গে দাঁড়িয়ে আছেন',
    aboutEyebrow: 'NBN সম্পর্কে',
    aboutTitle: 'সম্পর্কের শুরু হোক বোঝাপড়া দিয়ে',
    aboutP1: 'জীবনসঙ্গী বেছে নেওয়া জীবনের গুরুত্বপূর্ণ সিদ্ধান্তগুলোর একটি। NBN Match Making Event সেই সিদ্ধান্তের পথে মানুষকে পরিচিত হওয়ার সুযোগ করে দিতে চায়—যেখানে পছন্দ, মূল্যবোধ ও ভবিষ্যৎ ভাবনার কথা বলা যায় খোলামনে।',
    aboutP2: 'আমরা কোনো নির্দিষ্ট ফলের নিশ্চয়তা দিই না। বরং পরিচয় ও আলোচনার একটি সম্মানজনক সূচনা তৈরি করার লক্ষ্য রাখি।',
    aboutNote: 'আপনার স্বাচ্ছন্দ্য, গোপনীয়তা এবং পারস্পরিক সম্মতিই প্রতিটি পরিচয়ের ভিত্তি হওয়া উচিত।',
    promoAlt: 'NBN-এর বাংলা প্রচারচিত্রে জীবনসঙ্গী খোঁজার আহ্বান',
    stepsEyebrow: 'সহজ চারটি ধাপ',
    stepsTitle: 'পরিচয় থেকে সম্ভাবনার পথে',
    stepsDescription: 'প্রতিটি ধাপে নিজের সিদ্ধান্ত নিজে নিন। পরবর্তী পদক্ষেপ সবসময় আপনার সম্মতি ও স্বাচ্ছন্দ্যের উপর নির্ভরশীল।',
    steps: [
      ['প্রোফাইল তৈরি করুন', 'নিজের মৌলিক তথ্য ও পরিচয় দিয়ে যাত্রা শুরু করুন।'],
      ['পছন্দ জানান', 'আপনার মূল্যবোধ, পছন্দ এবং ভবিষ্যৎ ভাবনা শেয়ার করুন।'],
      ['মানানসই পরিচয় খুঁজুন', 'আপনার তথ্য ও পছন্দের ভিত্তিতে সম্ভাব্য পরিচয় অন্বেষণ করুন।'],
      ['পরবর্তী পদক্ষেপ নিন', 'স্বচ্ছতা ও পারস্পরিক সম্মতির সাথে যোগাযোগের সিদ্ধান্ত নিন।'],
    ],
    videosEyebrow: 'ভিডিও ও অভিজ্ঞতা',
    videosTitle: 'আমাদের গল্প, আমাদের অভিজ্ঞতা',
    videosDescription: 'জানুন মানুষের অভিজ্ঞতা এবং দেখুন NBN-এর বিভিন্ন মুহূর্ত।',
    videosPendingTitle: 'কোনো ভিডিও যুক্ত করা হয়নি',
    videosPending: 'নতুন ভিডিও এখানে দেখা যাবে।',
    videoDialogClose: 'বন্ধ করুন',
    videoNotAdded: 'ভিডিও এখনো যুক্ত করা হয়নি',
    videoDialogDescription: 'এই ভিডিওটি এখনো যুক্ত করা হয়নি।',
    okay: 'ঠিক আছে',
    videoInfoLabel: 'ভিডিও তথ্য খুলুন',
    ctaEyebrow: 'আপনার যাত্রা',
    ctaTitle: 'নিজের পরিচয় দিয়ে শুরু করুন',
    ctaDescription: 'রেজিস্ট্রেশন ফর্মটি দেখে আপনার প্রোফাইলের তথ্য সাজিয়ে নিন।',
    viewForm: 'ফর্মটি দেখুন',
    faqEyebrow: 'সাধারণ জিজ্ঞাসা',
    faqTitle: 'জানার আগে জেনে নিন',
    faqDescription: 'রেজিস্ট্রেশন ও ইভেন্ট সম্পর্কে পাঠকদের সাধারণ জিজ্ঞাসার উত্তর।',
    faqs: [
      ['রেজিস্ট্রেশন কীভাবে শুরু করব?', 'উপরের “রেজিস্ট্রেশন করুন” বোতামে ক্লিক করে ফর্মটি পূরণ করুন। প্রয়োজনীয় তথ্য দিয়ে ধাপে ধাপে এগিয়ে যান এবং শেষে জমা দিন।'],
      ['কোন তথ্য দিতে হবে?', 'ব্যক্তিগত, যোগাযোগ, পারিবারিক এবং পছন্দ-সংক্রান্ত তথ্য দিতে হবে। যে তথ্য এখন আপনার কাছে নেই, সেই ঘর পরে পূরণ করতে পারেন।'],
      ['আমার তথ্য কীভাবে ব্যবহৃত হবে?', 'আপনার দেওয়া তথ্য ইভেন্টের মিল তৈরি ও যোগাযোগের উদ্দেশ্যে ব্যবহৃত হবে এবং গোপনীয়তার সাথে সুরক্ষিত থাকবে।'],
      ['রেজিস্ট্রেশন ফি আছে কি?', 'রেজিস্ট্রেশন ও ইভেন্ট সংক্রান্ত কোনো ফি থাকলে তা ইভেন্টের ঘোষণার সাথে জানানো হবে।'],
    ],
    footerDescription: 'বিশ্বাস, মূল্যবোধ ও পারস্পরিক বোঝাপড়ার ভিত্তিতে জীবনসঙ্গী খোঁজার একটি যত্নশীল যাত্রা।',
    footerExplore: 'পাতা ঘুরে দেখুন',
    footerInformation: 'গুরুত্বপূর্ণ তথ্য',
    footerPrivacy: 'গোপনীয়তা নীতি',
    footerTerms: 'শর্তাবলি',
    footerCopyright: 'সকল অধিকার সংরক্ষিত।',
    footerNavLabel: 'ফুটার নেভিগেশন',
  },
  en: {
    nav: ['Home', 'About NBN', 'How it works', 'Videos'],
    mainNavigation: 'Main navigation',
    mobileNavigation: 'Mobile navigation',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    register: 'Register now',
    brand: 'NBN Match Making Event',
    heroTitle: 'Find a life partner',
    heroAccent: 'with confidence',
    heroDescription: 'Begin your journey to find a life partner who aligns with your values, preferences, and hopes for the future—with NBN.',
    watchVideos: 'Watch videos',
    heroNoteTitle: 'A meaningful beginning',
    heroNote: 'At your pace, in your own way.',
    heroAlt: 'A couple dressed for their wedding standing together',
    aboutEyebrow: 'About NBN',
    aboutTitle: 'Let understanding begin the relationship',
    aboutP1: 'Choosing a life partner is one of life’s important decisions. NBN Match Making Event aims to help people meet along that journey—where preferences, values, and hopes for the future can be shared openly.',
    aboutP2: 'We do not guarantee any particular outcome. Our aim is to offer a respectful starting point for introductions and conversation.',
    aboutNote: 'Your comfort, privacy, and mutual consent should be the foundation of every introduction.',
    promoAlt: 'NBN Bengali promotional artwork inviting people to find a life partner',
    stepsEyebrow: 'Four simple steps',
    stepsTitle: 'From introduction to possibility',
    stepsDescription: 'Make your own choices at every step. What happens next should always depend on your consent and comfort.',
    steps: [
      ['Create a profile', 'Start with a few details about yourself.'],
      ['Share your preferences', 'Tell us about your values, preferences, and hopes for the future.'],
      ['Explore compatible introductions', 'Explore possible introductions based on the information and preferences you share.'],
      ['Choose your next step', 'Decide whether to connect with openness and mutual consent.'],
    ],
    videosEyebrow: 'Videos and experiences',
    videosTitle: 'Our stories, our experiences',
    videosDescription: 'Learn about people’s experiences and see moments from NBN.',
    videosPendingTitle: 'No videos have been added yet',
    videosPending: 'New videos will appear here.',
    videoDialogClose: 'Close',
    videoNotAdded: 'Video not added yet',
    videoDialogDescription: 'This video has not been added yet.',
    okay: 'Okay',
    videoInfoLabel: 'Open video details',
    ctaEyebrow: 'Your journey',
    ctaTitle: 'Start with your introduction',
    ctaDescription: 'Review the registration form and organize your profile information.',
    viewForm: 'View the form',
    faqEyebrow: 'Frequently asked questions',
    faqTitle: 'A few things to know',
    faqDescription: 'Answers to common questions about registration and the event.',
    faqs: [
      ['How do I start registration?', 'Click the “Register now” button above to fill in the form. Work through each step and submit when you are done.'],
      ['What information is needed?', 'Personal, contact, family, and preference details are collected. If you do not have something at hand, you can complete that field later.'],
      ['How will my information be used?', 'Your information is used for event matching and communication, and is kept private.'],
      ['Is there a registration fee?', 'If there is any fee for registration or the event, it will be announced together with the official event details.'],
    ],
    footerDescription: 'A thoughtful journey to finding a life partner, grounded in trust, values, and mutual understanding.',
    footerExplore: 'Explore',
    footerInformation: 'Information',
    footerPrivacy: 'Privacy policy',
    footerTerms: 'Terms',
    footerCopyright: 'All rights reserved.',
    footerNavLabel: 'Footer navigation',
  },
} satisfies Record<Language, Record<string, unknown>>;

function VideoDialog({ entry, onClose }: { entry: VideoEntry | null; onClose: () => void }) {
  const { language } = useLanguage();
  const text = copy[language];
  useEffect(() => {
    if (!entry) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    stopLenis(); // pause smooth scroll while the dialog is open
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      startLenis();
    };
  }, [entry, onClose]);
  if (!entry) return null;
  return <div className="video-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="video-dialog" role="dialog" aria-modal="true" aria-labelledby="video-dialog-title">
      <button className="dialog-close" aria-label={text.videoDialogClose} onClick={onClose} data-testid="button-close-video"><X /></button>
      <span className="eyebrow">{entry.category}</span>
      <h2 id="video-dialog-title">{entry.title}</h2>
      <div style={{ padding: 26, background: '#f5e8e8', borderRadius: 12, textAlign: 'center', color: '#82536a', margin: '18px 0' }}>
        <Play size={27} style={{ margin: '0 auto 12px' }} />
        <strong style={{ display: 'block' }}>{text.videoNotAdded}</strong>
      </div>
      <p>{entry.description} {text.videoDialogDescription}</p>
      <button className="button-outline" onClick={onClose} data-testid="button-dismiss-video">{text.okay}</button>
    </section>
  </div>;
}

function VideoGallery() {
  const [selected, setSelected] = useState<VideoEntry | null>(null);
  const { language } = useLanguage();
  const text = copy[language];
  return <>
    {videoEntries.length > 0 ? <div className="video-grid">
      {videoEntries.map((entry) => entry.embedUrl
        ? <article className="video-card video-card-embed" key={entry.id} data-testid={`video-${entry.id}`}>
            <div className="video-embed">
              <iframe src={entry.embedUrl} title={entry.title} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            </div>
            <div className="video-card-content"><small>{entry.category}</small><h3>{entry.title}</h3><p>{entry.description}</p></div>
          </article>
        : <button className="video-card" key={entry.id} onClick={() => setSelected(entry)} data-testid={`button-video-${entry.id}`} aria-label={`${entry.title} — ভিডিও তথ্য খুলুন`}>
            <div className="video-thumb"><span className="play-mark"><Play size={20} fill="currentColor" /></span></div>
            <div className="video-card-content"><small>{entry.category}</small><h3>{entry.title}</h3><p>{entry.description}</p></div>
          </button>)}
    </div> : <div className="video-empty-state" role="status" data-testid="status-videos-pending">
      <span className="video-empty-icon" aria-hidden="true"><Film size={23} /></span>
      <div><strong>{text.videosPendingTitle}</strong><p>{text.videosPending}</p></div>
    </div>}
    <VideoDialog entry={selected} onClose={() => setSelected(null)} />
  </>;
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const { language } = useLanguage();
  const text = copy[language];
  return <div className="faq-list">{text.faqs.map(([question, answer], i) => <article key={question} className="faq-item">
    <button className="faq-question" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} data-testid={`button-faq-${i}`}>
      {question}<span aria-hidden="true">{open === i ? '−' : '+'}</span>
    </button>{open === i && <div className="faq-answer" data-testid={`text-faq-answer-${i}`}>{answer}</div>}
  </article>)}</div>;
}

function Footer() {
  const { language } = useLanguage();
  const text = copy[language];
  return <footer className="site-footer"><div className="container-wide">
    <div className="footer-grid">
      <div className="footer-brand">
      <img src="/images/nbn-logo.jpeg" alt="NBN Match Making Event লোগো" draggable={false} loading="lazy" />
      <p>{text.footerDescription}</p>
    </div>
      <nav className="footer-links" aria-label={text.footerNavLabel}>
        <h3>{text.footerExplore}</h3>
        <a href="#about">{text.nav[1]}</a>
        <a href="#how-it-works">{text.nav[2]}</a>
        <a href="#stories">{text.nav[3]}</a>
        <Link href="/register">{text.register}</Link>
      </nav>
      <div className="footer-information">
        <h3>{text.footerInformation}</h3>
        <p>{text.footerPrivacy}</p>
        <p>{text.footerTerms}</p>
      </div>
    </div>
    <div className="footer-bottom">
      <span>© {new Date().getFullYear()} NBN Match Making Event.</span>
      <span>{text.footerCopyright}</span>
    </div>
  </div></footer>;
}

export default function HomePage() {
  const { language } = useLanguage();
  const text = copy[language];
  useEffect(() => {
    document.title = language === 'bn'
      ? 'NBN Match Making Event | বিশ্বাসের সাথে জীবনসঙ্গী খুঁজুন'
      : 'NBN Match Making Event | Find a life partner with confidence';
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.appendChild(description); }
    description.content = language === 'bn'
      ? 'মূল্যবোধ, পছন্দ ও ভবিষ্যৎ ভাবনার সাথে মানানসই জীবনসঙ্গী খোঁজার যাত্রা শুরু হোক NBN Match Making Event-এর সাথে।'
      : 'Begin your journey to find a life partner who aligns with your values, preferences, and hopes for the future with NBN Match Making Event.';
  }, [language]);
  return <div className="site-shell">
    <SiteHeader />
    <main>
      <section className="hero" id="home"><div className="container-wide hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">{text.brand}</span>
          <h1>{text.heroTitle} <span style={{ color: '#b6305d' }}>{text.heroAccent}</span></h1>
          <p>{text.heroDescription}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
            <Link className="button-primary" href="/register" data-testid="link-register-hero">{text.register} <ArrowRight size={17} /></Link>
            <a className="button-outline" href="#stories" data-testid="link-watch-stories"><Play size={15} /> {text.watchVideos}</a>
          </div>
        </div>
        <div className="hero-visual"><img className="hero-photo" src="/images/wedding-couple.jpg" alt="বিয়ের সাজে এক দম্পতি একসঙ্গে দাঁড়িয়ে আছেন" draggable={false} fetchPriority="high" />
          <div className="hero-note"><strong>{text.heroNoteTitle}</strong>{text.heroNote}</div>
        </div>
      </div></section>
      <section className="section" id="about"><div className="container-wide about-grid">
        <div className="about-photo-wrap"><img className="about-photo" src="/images/nbn-promo.jpg" alt={text.promoAlt} draggable={false} loading="lazy" /></div>
        <div className="about-copy"><span className="eyebrow">{text.aboutEyebrow}</span><h2 style={{ fontSize: 'clamp(2rem,3.4vw,3rem)', lineHeight: 1.3, color: '#542237' }}>{text.aboutTitle}</h2>
          <p>{text.aboutP1}</p>
          <p>{text.aboutP2}</p>
          <div className="note-strip">{text.aboutNote}</div>
        </div>
      </div></section>
      <section className="section" id="how-it-works" style={{ background: '#fffaf7' }}><div className="container-wide">
        <div className="section-heading"><span className="eyebrow">{text.stepsEyebrow}</span><h2>{text.stepsTitle}</h2><p>{text.stepsDescription}</p></div>
        <div className="steps-grid">{text.steps.map(([title,description], index) => <article key={title} className="step-item"><span className="step-num">0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </div></section>
      <section className="section video-section" id="stories"><div className="container-wide">
        <div className="section-heading"><span className="eyebrow">{text.videosEyebrow}</span><h2>{text.videosTitle}</h2><p>{text.videosDescription}</p></div>
        <VideoGallery />
      </div></section>
      <section className="section"><div className="container-wide"><div className="cta-band">
        <div><span className="eyebrow">{text.ctaEyebrow}</span><h2>{text.ctaTitle}</h2><p>{text.ctaDescription}</p></div>
        <Link className="button-primary" href="/register" data-testid="link-register-cta">{text.viewForm} <ArrowRight size={17} /></Link>
      </div></div></section>
      <section className="section" id="faq" style={{ paddingTop: 45 }}><div className="container-wide">
        <div className="section-heading faq-heading"><span className="eyebrow">{text.faqEyebrow}</span><h2>{text.faqTitle}</h2><p>{text.faqDescription}</p></div><FAQ />
      </div></section>
    </main>
    <Footer />
  </div>;
}
