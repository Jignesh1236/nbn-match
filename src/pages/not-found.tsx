import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';

export default function NotFound() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="section" style={{ minHeight: '58vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <span className="eyebrow">404</span>
          <h1 style={{ color: '#55263b', margin: '10px 0', fontSize: 'clamp(1.8rem,3.5vw,2.6rem)' }}>পেজটি খুঁজে পাওয়া যায়নি</h1>
          <p style={{ color: '#75616a' }}>দুঃখিত, আপনি যে পেজটি খুঁজছেন সেটি নেই বা সরিয়ে ফেলা হয়েছে।</p>
          <p style={{ color: '#75616a', marginTop: 4 }}>The page you are looking for does not exist or has been moved.</p>
          <Link className="button-primary" to="/" style={{ marginTop: 20 }} data-testid="link-back-home-404"><ArrowLeft size={17} /> মূল পাতায় ফিরুন</Link>
        </div>
      </main>
    </div>
  );
}
