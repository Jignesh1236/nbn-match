import { useState, type MouseEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Menu, X } from 'lucide-react';
import { LanguageToggle } from '@/components/language-toggle';
import { useLanguage, type Language } from '@/lib/language';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

const sectionLinks = ['#home', '#about', '#how-it-works', '#stories'];

type HeaderLabels = {
  nav: string[];
  mainNavigation: string;
  mobileNavigation: string;
  openMenu: string;
  closeMenu: string;
  register: string;
  brand: string;
};

const headerLabels: Record<Language, HeaderLabels> = {
  bn: {
    nav: ['হোম', 'NBN সম্পর্কে', 'যেভাবে কাজ করে', 'ভিডিও'],
    mainNavigation: 'প্রধান নেভিগেশন',
    mobileNavigation: 'মোবাইল নেভিগেশন',
    openMenu: 'মেনু খুলুন',
    closeMenu: 'মেনু বন্ধ করুন',
    register: 'রেজিস্ট্রেশন করুন',
    brand: 'NBN Match Making Event',
  },
  en: {
    nav: ['Home', 'About NBN', 'How it works', 'Videos'],
    mainNavigation: 'Main navigation',
    mobileNavigation: 'Mobile navigation',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    register: 'Register now',
    brand: 'NBN Match Making Event',
  },
};

/**
 * Shared site navbar, used on every page (home, register, ...).
 *
 * Section links (#home, #about, #how-it-works, #stories) live on the home page:
 * - from the home page the browser + Lenis handle the smooth anchor scroll;
 * - from any other page we navigate home first, then scroll to the section
 *   once it has rendered.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const hidden = useScrollDirection();
  const { language } = useLanguage();
  const [location, navigate] = useLocation();
  const text = headerLabels[language];

  const handleSectionClick = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    const id = href.slice(1);
    const target = document.getElementById(id);
    // On the home page the section exists: default anchor + Lenis smooth scroll.
    if (target && location === '/') return;
    event.preventDefault();
    // Section exists but we are on another page: scroll directly.
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // Section lives on the home page: navigate there, then scroll once it rendered.
    navigate('/');
    const interval = window.setInterval(() => {
      const section = document.getElementById(id);
      if (!section) return;
      window.clearInterval(interval);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    window.setTimeout(() => window.clearInterval(interval), 4000);
  };

  return <header className={`site-header${hidden && !open ? ' header-hidden' : ''}`}>
    <div className="container-wide" style={{ minHeight: 78, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
      <Link href="/" aria-label={`${text.brand} — ${text.nav[0]}`} data-testid="link-home"><img src="/images/nbn-logo.jpeg" alt="NBN Match Making Event" draggable={false} style={{ width: 72, height: 65, objectFit: 'contain', mixBlendMode: 'multiply' }} /></Link>
      <nav className="desktop-nav" aria-label={text.mainNavigation} style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        {text.nav.map((label, index) => <a className="nav-link" key={sectionLinks[index]} href={sectionLinks[index]} data-testid={`link-nav-${sectionLinks[index].slice(1)}`} onClick={handleSectionClick(sectionLinks[index])}>{label}</a>)}
        <LanguageToggle />
        <Link className="button-primary" href="/register" data-testid="link-register-nav">{text.register} <ArrowRight size={16} /></Link>
      </nav>
      <div className="mobile-header-actions">
        <LanguageToggle />
        <button className="mobile-menu" type="button" aria-label={open ? text.closeMenu : text.openMenu} aria-expanded={open} onClick={() => setOpen(!open)} data-testid="button-mobile-menu">
        {open ? <X /> : <Menu />}
        </button>
      </div>
    </div>
    {open && <nav className="mobile-nav" aria-label={text.mobileNavigation}>
      {text.nav.map((label, index) => <a className="nav-link" key={sectionLinks[index]} href={sectionLinks[index]} onClick={(event) => { setOpen(false); handleSectionClick(sectionLinks[index])(event); }}>{label}</a>)}
      <Link className="button-primary" href="/register" onClick={() => setOpen(false)}>{text.register} <ArrowRight size={16} /></Link>
    </nav>}
  </header>;
}
