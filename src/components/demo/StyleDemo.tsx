import { Spinner } from '../ui';
import { TypingIndicator } from '../Chat';

/**
 * Demo component to showcase the base component styles
 * This is for testing and demonstration purposes only
 */
export function StyleDemo() {
  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3">Button Styles</h2>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm">Primary SM</button>
            <button className="btn btn-secondary btn-sm">Secondary SM</button>
            <button className="btn btn-ghost btn-sm">Ghost SM</button>
            <button className="btn btn-danger btn-sm">Danger SM</button>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-md">Primary MD</button>
            <button className="btn btn-secondary btn-md">Secondary MD</button>
            <button className="btn btn-ghost btn-md">Ghost MD</button>
            <button className="btn btn-danger btn-md">Danger MD</button>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-lg">Primary LG</button>
            <button className="btn btn-secondary btn-lg">Secondary LG</button>
            <button className="btn btn-ghost btn-lg">Ghost LG</button>
            <button className="btn btn-danger btn-lg">Danger LG</button>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-md">Outline</button>
            <button className="btn btn-primary btn-md loading">Loading</button>
            <button className="btn btn-secondary btn-md" disabled>
              Disabled
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Input Styles</h2>
        <div className="space-y-2">
          <input className="input input-sm" placeholder="Small input" />
          <input className="input input-md" placeholder="Medium input" />
          <input className="input input-lg" placeholder="Large input" />
          <input className="input input-md error" placeholder="Error state" />
          <input className="input input-md success" placeholder="Success state" />
          <textarea className="input textarea" placeholder="Textarea example" rows={3} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Card Styles</h2>
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Basic Card</h3>
              <p className="card-description">This is a basic card example</p>
            </div>
            <div className="card-body">
              <p>This is the card body content. It can contain any HTML content.</p>
            </div>
            <div className="card-footer">
              <button className="btn btn-primary btn-sm">Action</button>
            </div>
          </div>

          <div className="card card-elevated">
            <div className="card-header">
              <h3 className="card-title">Elevated Card</h3>
              <p className="card-description">This card has elevated shadow</p>
            </div>
            <div className="card-body">
              <p>Elevated cards have more prominent shadows for hierarchy.</p>
            </div>
          </div>

          <div className="card card-interactive">
            <div className="card-header">
              <h3 className="card-title">Interactive Card</h3>
              <p className="card-description">This card responds to hover</p>
            </div>
            <div className="card-body">
              <p>Hover over this card to see the interactive effect.</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Spinner Components</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-md font-medium mb-2">Sizes</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-sm">Small (16px)</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner size="md" />
                <span className="text-sm">Medium (24px)</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner size="lg" />
                <span className="text-sm">Large (32px)</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner size="xl" />
                <span className="text-sm">Extra Large (48px)</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-md font-medium mb-2">With Labels</h3>
            <div className="space-y-2">
              <Spinner label="Loading content..." />
              <Spinner size="sm" label="Processing..." />
            </div>
          </div>

          <div>
            <h3 className="text-md font-medium mb-2">Color Variants</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Spinner className="text-blue-600" />
                <span className="text-sm">Blue</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner className="text-green-600" />
                <span className="text-sm">Green</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner className="text-red-600" />
                <span className="text-sm">Red</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner className="text-purple-600" />
                <span className="text-sm">Purple</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-md font-medium mb-2">In Buttons</h3>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-md flex items-center gap-2" disabled>
                <Spinner size="sm" className="text-white" />
                Loading...
              </button>
              <button className="btn btn-secondary btn-md flex items-center gap-2" disabled>
                <Spinner size="sm" />
                Processing
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Typing Indicator Components</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-md font-medium mb-2">Sizes</h3>
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

          <div>
            <h3 className="text-md font-medium mb-2">Custom Text</h3>
            <div className="space-y-2">
              <TypingIndicator visible={true} text="Claude is thinking..." />
              <TypingIndicator visible={true} text="Generating response..." size="small" />
            </div>
          </div>

          <div>
            <h3 className="text-md font-medium mb-2">Animation Speeds</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="w-16 text-sm">Slow:</span>
                <TypingIndicator visible={true} speed="slow" />
              </div>
              <div className="flex items-center gap-4">
                <span className="w-16 text-sm">Normal:</span>
                <TypingIndicator visible={true} speed="normal" />
              </div>
              <div className="flex items-center gap-4">
                <span className="w-16 text-sm">Fast:</span>
                <TypingIndicator visible={true} speed="fast" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-md font-medium mb-2">Color Variants</h3>
            <div className="space-y-2">
              <TypingIndicator visible={true} text="Blue variant" className="text-blue-500" />
              <TypingIndicator visible={true} text="Green variant" className="text-green-500" />
              <TypingIndicator visible={true} text="Purple variant" className="text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Utility Classes</h2>
        <div className="space-y-2">
          <div className="loading-spinner w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
          <div className="fade-in">Fade in animation</div>
          <div className="slide-up">Slide up animation</div>
          <div className="error-state p-2 rounded">Error state styling</div>
          <div className="success-state p-2 rounded">Success state styling</div>
          <div className="loading-overlay p-4 rounded">Content with loading overlay</div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Accessibility Features</h2>
        <div className="space-y-2">
          <button className="btn btn-primary focusable">Focusable button</button>
          <span className="sr-only">This text is only for screen readers</span>
          <div className="focusable p-2 border rounded" tabIndex={0}>
            Focusable div with keyboard navigation
          </div>
        </div>
      </div>
    </div>
  );
}
