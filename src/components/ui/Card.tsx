import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility function for combining classes with proper precedence
const cn = (...inputs: (string | undefined | null | false)[]) => {
  return twMerge(clsx(inputs));
};

// Card variant types
type CardVariant = 'basic' | 'elevated' | 'interactive';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardBorder = 'default' | 'none' | 'subtle';

// Base Card Props Interface
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  border?: CardBorder;
  className?: string;
  onClick?: () => void;
}

// Sub-component Props Interfaces
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
  className?: string;
}

// Card Component
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'basic',
      padding = 'md',
      border = 'default',
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const isInteractive = variant === 'interactive' || !!onClick;

    // Build class names based on props
    const cardClasses = cn(
      // Base card styles from components.css
      'card',

      // Variant classes
      variant === 'elevated' && 'card-elevated',
      variant === 'interactive' && 'card-interactive',

      // Padding classes
      padding === 'none' && 'p-0',
      padding === 'sm' && 'p-3',
      padding === 'md' && 'p-4',
      padding === 'lg' && 'p-6',

      // Border classes
      border === 'none' && 'border-0',
      border === 'subtle' && 'border-gray-100',

      // Custom className
      className
    );

    // Interactive attributes
    const interactiveProps = isInteractive
      ? {
          role: 'button',
          tabIndex: 0,
          onKeyDown: (e: React.KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && onClick) {
              e.preventDefault();
              onClick();
            }
          },
          onClick: onClick,
        }
      : {};

    return (
      <div ref={ref} className={cardClasses} {...interactiveProps} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header Sub-component
const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('card-header', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// Card Body Sub-component
const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('card-body', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

// Card Footer Sub-component
const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('card-footer', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// Card Title Sub-component
const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className, level = 3, ...props }, ref) => {
    const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

    return React.createElement(
      HeadingTag,
      {
        ref,
        className: cn('card-title', className),
        ...props,
      },
      children
    );
  }
);

CardTitle.displayName = 'CardTitle';

// Card Description Sub-component
const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <p ref={ref} className={cn('card-description', className)} {...props}>
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';

// Compound Component Pattern - Attach sub-components to main Card
// TypeScript requires explicit typing for compound components
type CardComponent = typeof Card & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
};

const CardWithSubComponents = Card as CardComponent;
CardWithSubComponents.Header = CardHeader;
CardWithSubComponents.Body = CardBody;
CardWithSubComponents.Footer = CardFooter;
CardWithSubComponents.Title = CardTitle;
CardWithSubComponents.Description = CardDescription;

// Export types for consumers
export type {
  CardProps,
  CardHeaderProps,
  CardBodyProps,
  CardFooterProps,
  CardTitleProps,
  CardDescriptionProps,
  CardVariant,
  CardPadding,
  CardBorder,
};

// Export the component with sub-components
export { CardWithSubComponents as Card };
