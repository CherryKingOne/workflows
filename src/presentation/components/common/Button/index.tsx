import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const baseStyles = "transition-all duration-200 flex items-center justify-center font-medium focus:outline-none focus:ring-2 focus:ring-white/20";
  
  const variants = {
    primary: "bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98]",
    ghost: "bg-transparent hover:bg-white/10 text-zinc-400 hover:text-white rounded-md"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
