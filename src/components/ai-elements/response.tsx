'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo, type ReactNode, useState } from 'react';
import { Streamdown } from 'streamdown';
import { Button } from '@/components/ui/button';
import { CheckIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import MermaidDiagram from './mermaid-diagram';
import GenerativeUI from './gen-ui';

type ResponseProps = ComponentProps<typeof Streamdown>;

interface CodeBlockProps {
  children?: ReactNode | { props: { className?: string; children: string } };
  className?: string;
}

const hasCodeProps = (
  children: unknown,
): children is { props: { className?: string; children: string } } => {
  return !!(children && typeof children === 'object' && 'props' in children && children.props);
};

const HoverableImage = (props: ComponentProps<'img'>) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const copyToClipboard = async () => {
    if (!props.src || typeof window === 'undefined' || !navigator.clipboard.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(props.src);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadImage = async () => {
    if (!props.src) return;

    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = props.src;

      // Extract filename from URL or use default
      const urlPath = new URL(props.src).pathname;
      const filename = urlPath.split('/').pop() || 'image.png';
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const CopyIcon_ = isCopied ? CheckIcon : CopyIcon;

  return (
    <div
      className="relative inline-block group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img {...props} className="rounded-lg overflow-hidden" />
      {isHovered && (
        <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <Button
              onClick={copyToClipboard}
              size="sm"
              variant="secondary"
              className="backdrop-blur-sm bg-background/80 hover:bg-background"
              title={isCopied ? 'Copied!' : 'Copy path'}
            >
              <CopyIcon_ size={14} />
            </Button>
            <Button
              onClick={downloadImage}
              size="sm"
              variant="secondary"
              className="backdrop-blur-sm bg-background/90 hover:bg-background"
              title="Download image"
            >
              <DownloadIcon size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const CodeBlock = (props: CodeBlockProps) => {
  const { children, className: propsClassName } = props;

  const className = hasCodeProps(children) ? children.props.className : propsClassName || '';
  const language = className ? className.replace('language-', '') : '';
  const content = hasCodeProps(children) ? children.props.children : String(children || '');

  if (language === 'mermaid') {
    return <MermaidDiagram chart={content} />;
  }

  if (language === 'jsx') {
    return <GenerativeUI jsxString={content} />;
  }

  return (
    <pre className={className}>
      <code className={className}>{content}</code>
    </pre>
  );
};

export const Response = memo(
  ({ className, ...props }: ResponseProps) => {
    // Convert relative image URLs to absolute URLs for Streamdown
    const processContent = (content: string) => {
      if (typeof content !== 'string') return content;

      // Replace relative /uploads/ paths with absolute URLs
      return content.replace(/!\[([^\]]*)\]\(\/uploads\/([^)]+)\)/g, (_, alt, filename) => {
        const absoluteUrl = `${window.location.origin}/uploads/${filename}`;
        return `![${alt}](${absoluteUrl})`;
      });
    };

    const processedProps = {
      ...props,
      children:
        typeof props.children === 'string' ? processContent(props.children) : props.children,
    };

    return (
      <Streamdown
        className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
        {...processedProps}
        components={{
          code: CodeBlock,
          pre: CodeBlock,
          img: HoverableImage,
        }}
      />
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = 'Response';
