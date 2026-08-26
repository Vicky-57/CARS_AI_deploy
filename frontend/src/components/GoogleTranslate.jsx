import { useEffect, useState } from "react";
import { Globe } from "lucide-react";

function GoogleTranslate() {
  const [currentLang, setCurrentLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferred_lang') || 'en';
    }
    return 'en';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_lang', currentLang);
    }
  }, [currentLang]);

  useEffect(() => {
    if (document.getElementById("google-translate-script")) return;

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,de",
          autoDisplay: false,
        },
        "google_translate_element"
      );
    };

    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Poll for the Google Translate select box on mount and force it to match our saved language
  useEffect(() => {
    const interval = setInterval(() => {
      const select = document.querySelector('.goog-te-combo');
      if (select) {
        clearInterval(interval);
        
        // If we want a translation and it hasn't happened yet, force it
        if (currentLang !== 'en' && !document.documentElement.className.includes('translated-')) {
          select.value = currentLang;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }, 200);

    // Stop polling after 5 seconds to avoid infinite loops if it fails completely
    setTimeout(() => clearInterval(interval), 5000);

    return () => clearInterval(interval);
  }, [currentLang]);

  const handleLanguageChange = (lang) => {
    setCurrentLang(lang);

    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = lang;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Detect if Google Translate is "stuck" (it ignores the change event after reverting to English)
      if (lang !== 'en') {
        setTimeout(() => {
          const isTranslated = document.documentElement.className.includes('translated-');
          if (!isTranslated) {
            // Widget is dead, force a reload to apply the cookie
            window.location.reload();
          }
        }, 500);
      }
    } else if (lang !== 'en') {
      window.location.reload();
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Hidden default widget */}
      <div id="google_translate_element" style={{ display: 'none' }} />

      {/* Custom sleek switcher */}
      <div
        className="notranslate"
        style={{
          display: 'flex',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          padding: 3,
          boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
          alignItems: 'center'
        }}
      >
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', color: '#64748b' }}>
          <Globe size={14} />
        </div>
        <button
          onClick={() => handleLanguageChange('en')}
          style={{
            padding: '4px 12px',
            borderRadius: 16,
            fontSize: '0.8rem',
            fontWeight: 700,
            border: 'none',
            background: currentLang === 'en' ? 'var(--brand-100, #ffedd5)' : 'transparent',
            color: currentLang === 'en' ? 'var(--brand-700, #c2410c)' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          EN
        </button>
        <button
          onClick={() => handleLanguageChange('de')}
          style={{
            padding: '4px 12px',
            borderRadius: 16,
            fontSize: '0.8rem',
            fontWeight: 700,
            border: 'none',
            background: currentLang === 'de' ? 'var(--brand-100, #ffedd5)' : 'transparent',
            color: currentLang === 'de' ? 'var(--brand-700, #c2410c)' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          DE
        </button>
      </div>
    </div>
  );
}

export default GoogleTranslate;
