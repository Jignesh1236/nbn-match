import { Languages } from 'lucide-react';
import { useLanguage } from '@/lib/language';

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  const nextLanguage = language === 'bn' ? 'English' : 'বাংলা';

  return (
    <button
      type="button"
      className="language-toggle"
      aria-label={language === 'bn' ? 'Switch language to English' : 'ভাষা বাংলায় পরিবর্তন করুন'}
      onClick={toggleLanguage}
      data-testid="button-language-toggle"
    >
      <Languages size={16} aria-hidden="true" />
      <span>{nextLanguage}</span>
    </button>
  );
}
