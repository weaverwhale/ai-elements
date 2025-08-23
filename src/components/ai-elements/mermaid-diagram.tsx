import React, { useEffect, useRef, memo } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '@/components/theme-provider';

// Initialize mermaid with configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'monospace',
});

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevChartRef = useRef<string>('');
  const { theme } = useTheme();

  useEffect(() => {
    // Skip if chart hasn't changed and theme hasn't changed
    const currentKey = `${chart}-${theme}`;
    if (currentKey === prevChartRef.current) return;

    prevChartRef.current = currentKey;

    // Reinitialize mermaid with the current theme
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'monospace',
    });

    if (containerRef.current) {
      // Clear previous diagram
      containerRef.current.innerHTML = '';

      // Create a div for the diagram
      const diagramDiv = document.createElement('div');
      diagramDiv.className = 'mermaid';
      diagramDiv.textContent = chart;

      // Add it to the container
      containerRef.current.appendChild(diagramDiv);

      // Render the diagram
      try {
        mermaid
          .run({
            nodes: [diagramDiv],
          })
          .catch((error) => {
            console.error('Mermaid rendering error:', error);
            if (containerRef.current) {
              containerRef.current.innerHTML = `<div class="mermaid-error">Error rendering diagram: ${error.message}</div>`;
            }
          });
      } catch (error) {
        console.error('Mermaid error:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="mermaid-error">Error rendering diagram</div>`;
        }
      }
    }
  }, [chart, theme]);

  return (
    <div className="my-4">
      <div ref={containerRef} className="mermaid-diagram"></div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(MermaidDiagram);
