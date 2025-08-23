import React, { useState, useEffect, useMemo } from 'react';
import { LiveProvider, LiveError, LivePreview } from 'react-live';
import './gen-ui.css';

interface GenerativeUIProps {
  jsxString: string;
  onError?: (error: Error) => void;
}

// Error boundary component to catch runtime errors
class ComponentErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Component Error Boundary caught error:', error);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <h3 className="text-red-800 font-semibold mb-2">Component Error</h3>
          <p className="text-red-700 text-sm mb-2">
            The generated component encountered a runtime error:
          </p>
          <pre className="text-xs bg-red-100 p-2 rounded overflow-x-auto">
            {this.state.error?.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Safe scope - only these imports/functions are available to generated components
const createSafeScope = () => ({
  // React essentials
  React,
  useState,
  useEffect,
  useMemo,

  // Safe utility functions
  console: {
    log: console.log,
    warn: console.warn,
    error: console.error,
  },

  // Math and formatting utilities
  Math,
  parseInt,
  parseFloat,
  Number,
  String,
  Array,
  Object,
  JSON,
  Date,

  // Intl for formatting (currency, dates, etc.)
  Intl,

  // Common array methods that are safe
  map: (arr: unknown[], fn: (item: unknown, index: number) => unknown) => arr.map(fn),
  filter: (arr: unknown[], fn: (item: unknown) => boolean) => arr.filter(fn),
  reduce: (
    arr: unknown[],
    fn: (acc: unknown, item: unknown, index: number) => unknown,
    initial: unknown,
  ) => arr.reduce(fn, initial),

  // Safe setTimeout/setInterval (with limits)
  setTimeout: (fn: () => void, delay: number) => {
    if (delay < 10000) {
      // Max 10 second delay
      return setTimeout(fn, delay);
    }
  },
  clearTimeout,
});

const GenerativeUI: React.FC<GenerativeUIProps> = ({ jsxString, onError }) => {
  // Memoize the safe scope to avoid recreation on every render
  const scope = useMemo(() => createSafeScope(), []);

  // Clean and prepare the code string
  const cleanCode = useMemo(() => {
    let code = jsxString.trim();

    // Remove markdown code block wrapper if present
    if (code.startsWith('```jsx') && code.endsWith('```')) {
      code = code.slice(6, -3).trim(); // Remove ```jsx from start and ``` from end
    } else if (code.startsWith('```javascript') && code.endsWith('```')) {
      code = code.slice(13, -3).trim(); // Remove ```javascript from start and ``` from end
    } else if (code.startsWith('```') && code.endsWith('```')) {
      code = code.slice(3, -3).trim(); // Remove generic ``` wrappers
    }

    // Remove any imports as they're not needed (everything is in scope)
    code = code.replace(/^import\s+.*?from\s+['"][^'"]*['"];?\s*/gm, '');

    // Extract function body using manual approach - find arrow function and extract body
    if (code.includes('=>') && code.includes('{')) {
      const arrowIndex = code.indexOf('=>');
      const openBraceIndex = code.indexOf('{', arrowIndex);

      if (openBraceIndex !== -1) {
        // Find the last closing brace (end of function)
        let lastCloseBraceIndex = code.lastIndexOf('};');
        if (lastCloseBraceIndex === -1) {
          lastCloseBraceIndex = code.lastIndexOf('}');
        }

        if (lastCloseBraceIndex > openBraceIndex) {
          const functionBody = code.substring(openBraceIndex + 1, lastCloseBraceIndex).trim();
          code = `function GeneratedComponent() {
${functionBody}
}`;
        } else {
          code = `function GeneratedComponent() {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded">
      <p className="text-red-800">Unable to parse component structure</p>
    </div>
  );
}`;
        }
      }
    }
    // If it's just JSX (starts with <), wrap it properly
    else if (code.trim().startsWith('<')) {
      code = `function GeneratedComponent() {
  return (
    ${code}
  );
}`;
    }
    // Fallback for any other case
    else {
      code = `function GeneratedComponent() {
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
      <p className="text-yellow-800">Unable to render provided code</p>
      <details className="mt-2">
        <summary className="cursor-pointer">Show raw code</summary>
        <pre className="text-xs mt-2 bg-yellow-100 p-2 rounded overflow-auto">{${JSON.stringify(
          code,
        )}}</pre>
      </details>
    </div>
  );
}`;
    }

    // Validate that the code looks reasonable
    if (!code.trim()) {
      code = `function EmptyComponent() {
  return (
    <div className="p-4 text-gray-500">No content provided</div>
  );
}`;
    }

    return code;
  }, [jsxString]);

  return (
    <div className="mx-4">
      <div className="mb-4 border rounded-lg overflow-hidden">
        <LiveProvider code={cleanCode} scope={scope}>
          {/* Show the rendered component */}
          <div className="border-b bg-white p-4">
            <ComponentErrorBoundary onError={onError}>
              <div className="w-full generative-ui-container">
                <LivePreview />
              </div>
            </ComponentErrorBoundary>
          </div>

          {/* Show any errors */}
          <LiveError className="bg-red-50 text-red-700 p-4 text-sm font-mono whitespace-pre-wrap" />

          {/* Show the code */}
          <details className="bg-gray-50 border-t">
            <summary className="cursor-pointer p-2 text-sm text-gray-600 hover:bg-gray-100">
              Show Generated Code
            </summary>
            <pre className="p-4 text-xs overflow-x-auto bg-gray-100">
              <code>{cleanCode}</code>
            </pre>
          </details>
        </LiveProvider>
      </div>
    </div>
  );
};

export default GenerativeUI;
