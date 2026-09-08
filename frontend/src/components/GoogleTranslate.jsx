import { useEffect, useState } from "react";
import { Globe } from "lucide-react";

/**
 * GoogleTranslate.jsx — v2
 *
 * Fixes for React SPA:
 *  - Sets the `googtrans` cookie directly (most reliable method for SPAs)
 *  - Uses MutationObserver to re-apply translation after React re-renders
 *  - Falls back to page reload if widget fails to apply (original behavior kept)
 */

function setGoogTransCookie(lang) {
  // Google Translate reads the `/en/${lang}` cookie value to determine target language
  if (lang === "en") {
    // Clear the cookie to revert to English
    document.cookie = "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "googtrans=; path=/; domain=" + window.location.hostname + "; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  } else {
    const val = `/en/${lang}`;
    document.cookie = `googtrans=${val}; path=/`;
    document.cookie = `googtrans=${val}; path=/; domain=${window.location.hostname}`;
  }
}

function triggerTranslation(lang) {
  const select = document.querySelector(".goog-te-combo");
  if (select) {
    select.value = lang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  return false;
}

function GoogleTranslate() {
  const [currentLang, setCurrentLang] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("preferred_lang") || "en";
    }
    return "en";
  });

  // Load the Google Translate script once
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

  // Apply saved language on mount (after widget loads)
  useEffect(() => {
    if (currentLang === "en") return;

    // Try immediately, then retry with interval until widget is ready
    let attempts = 0;
    const maxAttempts = 25; // 5 seconds total

    const interval = setInterval(() => {
      attempts++;
      const done = triggerTranslation(currentLang);
      if (done || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // MutationObserver: re-apply translation when React re-renders the DOM
  useEffect(() => {
    if (currentLang === "en") return;

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Check if translation was lost after a React render
        const isTranslated = document.documentElement.className.includes("translated-");
        if (!isTranslated && currentLang !== "en") {
          triggerTranslation(currentLang);
        }
      }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
    };
  }, [currentLang]);

  const handleLanguageChange = (lang) => {
    setCurrentLang(lang);
    localStorage.setItem("preferred_lang", lang);

    // Set the googtrans cookie (most reliable for SPAs)
    setGoogTransCookie(lang);

    if (lang === "en") {
      // Revert to English: reset cookie and reload to clear translation
      window.location.reload();
      return;
    }

    // Try widget trigger first
    const done = triggerTranslation(lang);
    if (!done) {
      // Widget not ready yet — cookie is set, reload will pick it up
      window.location.reload();
      return;
    }

    // Fallback: if widget didn't apply after 600ms, reload with cookie
    setTimeout(() => {
      const isTranslated = document.documentElement.className.includes("translated-");
      if (!isTranslated) {
        window.location.reload();
      }
    }, 600);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Hidden default widget */}
      <div id="google_translate_element" style={{ display: "none" }} />

      {/* Custom sleek switcher */}
      <div
        className="notranslate"
        style={{
          display: "flex",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 20,
          padding: 3,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          alignItems: "center",
        }}
      >
        <div style={{ padding: "0 8px", display: "flex", alignItems: "center", color: "#64748b" }}>
          <Globe size={14} />
        </div>
        <button
          onClick={() => handleLanguageChange("en")}
          style={{
            padding: "4px 12px",
            borderRadius: 16,
            fontSize: "0.8rem",
            fontWeight: 700,
            border: "none",
            background: currentLang === "en" ? "var(--brand-100, #ffedd5)" : "transparent",
            color: currentLang === "en" ? "var(--brand-700, #c2410c)" : "#64748b",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          EN
        </button>
        <button
          onClick={() => handleLanguageChange("de")}
          style={{
            padding: "4px 12px",
            borderRadius: 16,
            fontSize: "0.8rem",
            fontWeight: 700,
            border: "none",
            background: currentLang === "de" ? "var(--brand-100, #ffedd5)" : "transparent",
            color: currentLang === "de" ? "var(--brand-700, #c2410c)" : "#64748b",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          DE
        </button>
      </div>
    </div>
  );
}

export default GoogleTranslate;
