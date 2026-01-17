import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`bg-dark-card border border-dark-border rounded-xl p-6 shadow-lg ${className || ''}`}
      {...props}
    />
  )
);

Card.displayName = 'Card';

export { Card };
