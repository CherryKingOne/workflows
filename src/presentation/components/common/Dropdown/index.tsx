import React, { useState, useRef, useEffect } from 'react';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Dropdown({ options, value, onChange, className = '' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center justify-between w-full h-9 rounded-lg text-sm px-3 border border-white/10 bg-[#0a0a0a] text-zinc-300 hover:bg-white/5 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 shadow-inner"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="mr-2 truncate font-medium">{selectedOption.label}</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={`transition-transform duration-300 text-zinc-400 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute z-10 w-full min-w-[140px] mt-2 bg-[#111111] border border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] py-1.5 right-0 origin-top-right transform opacity-100 scale-100 transition-all backdrop-blur-md"
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 flex items-center justify-between ${
                value === option.value 
                  ? 'bg-white/10 text-white font-medium' 
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
