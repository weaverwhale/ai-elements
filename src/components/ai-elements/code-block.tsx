'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckIcon, CopyIcon } from 'lucide-react';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { codeToHtml } from 'shiki';
import { useTheme } from '@/components/theme-provider';

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
});

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  children?: ReactNode;
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string>('');

  useEffect(() => {
    const updateTheme = () => {
      if (theme === 'dark') {
        setIsDark(true);
      } else if (theme === 'light') {
        setIsDark(false);
      } else {
        // system theme
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };

    updateTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
  }, [theme]);

  useEffect(() => {
    const highlightCode = async () => {
      try {
        const html = await codeToHtml(code, {
          lang: language,
          theme: isDark ? 'dark-plus' : 'light-plus',
          transformers: showLineNumbers
            ? [
                {
                  name: 'line-numbers',
                  line(node, line) {
                    node.children.unshift({
                      type: 'element',
                      tagName: 'span',
                      properties: {
                        class: 'line-number',
                        style:
                          'color: hsl(var(--muted-foreground)); padding-right: 1rem; min-width: 2.5rem; display: inline-block;',
                      },
                      children: [{ type: 'text', value: line.toString() }],
                    });
                  },
                },
              ]
            : undefined,
        });
        setHighlightedCode(html);
      } catch (error) {
        console.error('Error highlighting code:', error);
        setHighlightedCode(`<pre><code>${code}</code></pre>`);
      }
    };

    highlightCode();
  }, [code, language, isDark, showLineNumbers]);

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-md border bg-background text-foreground',
          className,
        )}
        {...props}
      >
        <div className="relative">
          <div
            className="overflow-hidden"
            style={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            }}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
          {children && (
            <div className="absolute top-2 right-2 flex items-center gap-2">{children}</div>
          )}
        </div>
      </div>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator.clipboard.writeText) {
      onError?.(new Error('Clipboard API not available'));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn('shrink-0', className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
