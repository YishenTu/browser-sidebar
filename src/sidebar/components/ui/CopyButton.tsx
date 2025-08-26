import React, { useState } from 'react';
import { cn } from '@sidebar/lib/cn';
import { CopyIcon, CheckIcon } from './Icons';

export interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Text to copy to clipboard */
  text: string;
  /** Optional callback on successful copy */
  onCopy?: () => void;
  /** Size of the icon (default: 14) */
  iconSize?: number;
  /** Optional CSS class name */
  className?: string;
}

/**
 * CopyButton Component
 *
 * A reusable button that copies text to clipboard with visual feedback.
 * Shows a check icon for 2 seconds after successful copy.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  onCopy,
  iconSize = 14,
  className,
  ...props
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn('copy-button', className)}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      type="button"
      {...props}
    >
      {copied ? (
        <CheckIcon size={iconSize} className="copy-button-icon" />
      ) : (
        <CopyIcon size={iconSize} className="copy-button-icon" />
      )}
    </button>
  );
};

export default CopyButton;
