import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import GenerativeUI from './ai-elements/gen-ui';
import { Button } from './ui/button';
import { ArrowLeft, Copy, Download, Share2 } from 'lucide-react';

export const GenUIViewer = () => {
  const [searchParams] = useSearchParams();
  const [jsxString, setJsxString] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    // Try to get JSX string from URL params first
    const jsxFromUrl = searchParams.get('jsx');
    const titleFromUrl = searchParams.get('title') || 'Generated UI Component';
    const conversationIdFromUrl = searchParams.get('conversation');

    if (jsxFromUrl) {
      try {
        const decodedJsx = decodeURIComponent(jsxFromUrl);
        setJsxString(decodedJsx);
        setTitle(titleFromUrl);
        setConversationId(conversationIdFromUrl);
      } catch (error) {
        console.error('Failed to decode JSX from URL:', error);
        setJsxString('Error: Failed to load component data');
        setTitle('Error');
      }
    } else {
      // Fallback to localStorage if no URL params
      try {
        const storedJsx = localStorage.getItem('genui-viewer-jsx');
        const storedTitle = localStorage.getItem('genui-viewer-title');
        if (storedJsx) {
          setJsxString(storedJsx);
          setTitle(storedTitle || 'Generated UI Component');
        } else {
          setJsxString('No component data found. Please generate a UI component first.');
          setTitle('No Component');
        }
      } catch (error) {
        console.error('Failed to load from localStorage:', error);
        setJsxString('Error loading component data');
        setTitle('Error');
      }
    }
  }, [searchParams]);

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsxString);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleDownloadComponent = () => {
    const blob = new Blob([jsxString], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.jsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareComponent = async () => {
    const currentUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `AI Elements - ${title}`,
          text: 'Check out this generated UI component!',
          url: currentUrl,
        });
      } else {
        // Fallback to copying URL to clipboard
        await navigator.clipboard.writeText(currentUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to={conversationId ? `/?conversation=${conversationId}` : '/'}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Chat
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">{title}</h1>
                <p className="text-sm text-muted-foreground">Full Screen UI Component View</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCopyToClipboard} variant="outline" size="sm" className="gap-2">
                <Copy className="h-4 w-4" />
                {copySuccess ? 'Copied!' : 'Copy JSX'}
              </Button>
              <Button
                onClick={handleDownloadComponent}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button onClick={handleShareComponent} variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-4">
        {jsxString ? (
          <GenerativeUI
            jsxString={jsxString}
            onError={(error) => {
              console.error('GenUI viewer error:', error);
            }}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Loading component...</p>
          </div>
        )}
      </div>
    </div>
  );
};
