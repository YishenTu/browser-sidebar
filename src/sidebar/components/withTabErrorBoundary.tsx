/**
 * @file withTabErrorBoundary HOC
 * Higher-order component to wrap components with TabErrorBoundary
 */

import React from 'react';
import { TabErrorBoundary, TabErrorBoundaryProps } from './TabErrorBoundary';

/**
 * Higher-order component to wrap components with TabErrorBoundary
 */
export function withTabErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps?: Partial<TabErrorBoundaryProps>
) {
  const WrappedComponent = React.forwardRef<unknown, P>((props, ref) => {
    const componentProps = { ...props } as P;
    return (
      <TabErrorBoundary {...boundaryProps}>
        <Component {...componentProps} ref={ref} />
      </TabErrorBoundary>
    );
  });

  WrappedComponent.displayName = `withTabErrorBoundary(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WrappedComponent;
}
