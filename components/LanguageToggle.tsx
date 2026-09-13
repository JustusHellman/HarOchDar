import React from "react";
import { useLanguage } from "../i18n";

interface LanguageToggleProps {
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = "" }) => {
  const { language, toggleLanguage } = useLanguage();

  const isSv = language === "sv";

  return (
    <button
      onClick={toggleLanguage}
      type="button"
      aria-label={isSv ? "Switch to English" : "Byt till svenska"}
      title={isSv ? "Byt till English" : "Switch to Svenska"}
      className={`group flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md border border-black/10 rounded-full shadow-sm hover:shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all duration-200 text-[#0f1a16] select-none cursor-pointer ${className}`}
    >
      <span className="text-base leading-none transition-transform group-hover:scale-110">
        {isSv ? "🇸🇪" : "🇬🇧"}
      </span>
      <span className="text-[10px] font-black uppercase tracking-wider leading-none text-[#0f1a16]">
        {isSv ? "SV" : "EN"}
      </span>
    </button>
  );
};

export default LanguageToggle;
