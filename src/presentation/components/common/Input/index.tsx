import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label className="text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            h-10 px-3 rounded-lg text-sm bg-[#0a0a0a] border transition-all duration-200 outline-none
            ${error 
              ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-red-400 placeholder-red-900/50' 
              : 'border-white/10 text-white focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 placeholder-zinc-600 shadow-inner'
            }
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 mt-0.5">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
