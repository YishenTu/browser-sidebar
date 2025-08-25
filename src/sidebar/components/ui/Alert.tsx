import React from 'react';
import { ErrorIcon, WarningIcon, InfoIcon, CloseIcon } from './Icons';

export type AlertType = 'error' | 'warning' | 'info' | 'success';

export interface AlertAction {
  label: string;
  handler: () => void;
}

export interface AlertProps {
  /** Alert type determines color scheme and icon */
  type?: AlertType;
  /** Alert message */
  message: string;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Callback when alert is dismissed */
  onDismiss?: () => void;
  /** Optional action button */
  action?: AlertAction;
  /** Custom CSS class */
  className?: string;
  /** Show icon */
  showIcon?: boolean;
  /** Additional content below message */
  children?: React.ReactNode;
  /** Additional badge text (e.g., "+3 more") */
  badge?: string;
}

/**
 * Alert Component
 *
 * A reusable alert/banner component for displaying messages, warnings, and errors.
 */
export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  message,
  dismissible = true,
  onDismiss,
  action,
  className = '',
  showIcon = true,
  children,
  badge,
}) => {
  const getIcon = () => {
    if (!showIcon) return null;

    switch (type) {
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
      case 'success':
        return <InfoIcon />; // You can add a CheckIcon if needed
      default:
        return null;
    }
  };

  return (
    <div
      className={`alert alert--${type} ${className}`}
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="alert__content">
        {showIcon && <div className="alert__icon">{getIcon()}</div>}

        <div className="alert__message">
          <span>{message}</span>
          {badge && <span className="alert__badge">{badge}</span>}
        </div>
      </div>

      <div className="alert__actions">
        {action && (
          <button onClick={action.handler} className="alert__action-button" type="button">
            {action.label}
          </button>
        )}

        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="alert__dismiss-button"
            aria-label="Dismiss alert"
            title="Dismiss"
            type="button"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      {children && <div className="alert__extra-content">{children}</div>}
    </div>
  );
};

export default Alert;
