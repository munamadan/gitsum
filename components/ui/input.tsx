import * as React from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={`w-full bg-dark-card text-dark-text border-2 border-dark-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 transition-all duration-200 placeholder:text-dark-muted ${className || ''}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
