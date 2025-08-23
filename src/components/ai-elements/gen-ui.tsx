// src/components/GenerativeUIDisplay/index.tsx
import React from 'react';
import JsxParser from 'react-jsx-parser';
import './gen-ui.css';

interface GenerativeUIProps {
  jsxString: string;
  onError?: (error: Error) => void;
}

const GenerativeUI: React.FC<GenerativeUIProps> = ({ jsxString, onError }) => {
  try {
    // Basic sanitization: Trim whitespace
    const cleanJsxString = jsxString.trim();

    // Add a wrapper div with consistent styling
    return (
      <div className="mx-4">
        <JsxParser
          jsx={cleanJsxString}
          // We can add bindings here later if we need custom components
          // bindings={{}}
          // We can add allowed components for security
          // components={ { /* Example: div: 'div', span: 'span' */ } }
          renderInWrapper={false} // The wrapper div above handles this
          showWarnings={process.env.NODE_ENV === 'development'} // Show warnings only in dev
          onError={(error) => {
            console.error('GenerativeUI Parsing Error:', error);
            if (onError) {
              onError(error);
            }
          }}
        />
      </div>
    );
  } catch (error) {
    console.error('GenerativeUI Rendering Error:', error);
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
    return (
      <div className="mx-4">
        <p>Error rendering UI:</p>
        <pre>{error instanceof Error ? error.message : String(error)}</pre>
        <p>Raw JSX:</p>
        <pre>{jsxString}</pre>
      </div>
    );
  }
};

export default GenerativeUI;
