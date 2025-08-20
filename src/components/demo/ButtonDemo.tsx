import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * ButtonDemo component showcasing the Button component usage
 * This component demonstrates all the Button variants, sizes, and states.
 */
export const ButtonDemo: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleAsyncAction = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000); // Simulate async action
  };

  return (
    <div className="p-6 space-y-8 bg-white">
      <div>
        <h2 className="text-xl font-bold mb-4">Button Component Demo</h2>
        <p className="text-gray-600 mb-6">
          Showcasing all variants, sizes, and states of the Button component.
        </p>
      </div>

      {/* Variants */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Variants</h3>
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="outline">Outline</Button>
        </div>
      </div>

      {/* Sizes */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Sizes</h3>
        <div className="flex items-center gap-4">
          <Button size="sm" variant="primary">
            Small
          </Button>
          <Button size="md" variant="primary">
            Medium
          </Button>
          <Button size="lg" variant="primary">
            Large
          </Button>
        </div>
      </div>

      {/* States */}
      <div>
        <h3 className="text-lg font-semibold mb-4">States</h3>
        <div className="flex flex-wrap gap-4">
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
          <Button loading loadingText="Processing...">
            Loading with Text
          </Button>
          <Button onClick={handleAsyncAction} loading={loading} loadingText="Saving...">
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Interactive Examples */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Interactive Examples</h3>
        <div className="flex flex-wrap gap-4">
          <Button onClick={() => alert('Primary clicked!')}>Click Me</Button>
          <Button
            variant="secondary"
            onClick={() => {
              /* no-op */
            }}
          >
            Secondary Action
          </Button>
          <Button variant="outline" type="submit">
            Submit Form
          </Button>
        </div>
      </div>

      {/* Custom Styling */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Custom Styling</h3>
        <div className="flex flex-wrap gap-4">
          <Button className="bg-purple-600 hover:bg-purple-700" variant="primary">
            Custom Purple
          </Button>
          <Button className="rounded-full" variant="outline">
            Round Button
          </Button>
          <Button className="w-full" variant="primary">
            Full Width
          </Button>
        </div>
      </div>

      {/* Accessibility Examples */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Accessibility</h3>
        <div className="flex flex-wrap gap-4">
          <Button aria-label="Close dialog" variant="ghost">
            ×
          </Button>
          <Button aria-describedby="help-text" variant="primary">
            Help Button
          </Button>
          <p id="help-text" className="text-sm text-gray-500 mt-2">
            This button provides help information
          </p>
        </div>
      </div>
    </div>
  );
};
