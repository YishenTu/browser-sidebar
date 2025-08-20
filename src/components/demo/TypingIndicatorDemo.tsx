import React, { useState, useEffect } from 'react';
import { TypingIndicator } from '../Chat/TypingIndicator';

/**
 * Demo component showcasing the TypingIndicator functionality
 */
export const TypingIndicatorDemo: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Auto toggle for demo
  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">TypingIndicator Demo</h2>

        <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Auto Toggle Demo</h3>
            <span className="text-sm text-gray-600">{isVisible ? 'Visible' : 'Hidden'}</span>
          </div>

          <div className="min-h-[32px] flex items-center">
            <TypingIndicator visible={isVisible} />
          </div>
        </div>

        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium">Size Variants</h3>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm">Small:</span>
              <TypingIndicator visible={true} size="small" />
            </div>

            <div className="flex items-center gap-4">
              <span className="w-16 text-sm">Medium:</span>
              <TypingIndicator visible={true} size="medium" />
            </div>

            <div className="flex items-center gap-4">
              <span className="w-16 text-sm">Large:</span>
              <TypingIndicator visible={true} size="large" />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium">Custom Text</h3>

          <div className="space-y-3">
            <TypingIndicator visible={true} text="Claude is thinking..." />

            <TypingIndicator visible={true} text="Generating response..." size="small" />

            <TypingIndicator visible={true} text="Processing your request..." size="large" />
          </div>
        </div>

        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium">Animation Speeds</h3>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm">Slow:</span>
              <TypingIndicator visible={true} speed="slow" text="Slow animation" />
            </div>

            <div className="flex items-center gap-4">
              <span className="w-16 text-sm">Normal:</span>
              <TypingIndicator visible={true} speed="normal" text="Normal animation" />
            </div>

            <div className="flex items-center gap-4">
              <span className="w-16 text-sm">Fast:</span>
              <TypingIndicator visible={true} speed="fast" text="Fast animation" />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium">Color Variants</h3>

          <div className="space-y-3">
            <TypingIndicator visible={true} text="Blue variant" className="text-blue-500" />

            <TypingIndicator visible={true} text="Green variant" className="text-green-500" />

            <TypingIndicator visible={true} text="Purple variant" className="text-purple-500" />
          </div>
        </div>

        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium">Interactive Controls</h3>

          <div className="space-y-3">
            <button
              onClick={() => setIsVisible(!isVisible)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Toggle Visibility
            </button>

            <div className="min-h-[32px] flex items-center">
              <TypingIndicator visible={isVisible} text="Toggled by button" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
