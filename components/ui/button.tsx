import * as React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const baseStyles = 'font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-mint-500 disabled:opacity-50 disabled:cursor-not-allowed';

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const variants = {
      default: 'bg-mint-500 text-white hover:bg-mint-600 active:scale-95 shadow-md shadow-mint-500/20',
      outline: 'bg-transparent text-mint-400 border-2 border-mint-400 hover:bg-mint-400 hover:text-white active:scale-95',
      ghost: 'bg-transparent text-mint-400 hover:bg-mint-400/10 active:scale-95',
    };

    return (
      <button
        className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className || ''}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
