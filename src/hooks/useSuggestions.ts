import { useState, useEffect } from 'react';

interface SuggestionItem {
  id: string;
  text: string;
  category?: string;
}

interface SuggestionsResponse {
  suggestions: SuggestionItem[];
  total: number;
  categories: string[];
}

interface UseSuggestionsOptions {
  category?: string;
  limit?: number;
  autoFetch?: boolean;
}

export const useSuggestions = (options: UseSuggestionsOptions = {}) => {
  const { category, limit = 6, autoFetch = true } = options;
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (limit) params.set('limit', limit.toString());

      const url = `/api/suggestions${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
      }

      const data: SuggestionsResponse = await response.json();
      setSuggestions(data.suggestions);
      setCategories(data.categories);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching suggestions:', err);

      // Fallback suggestions in case of error
      setSuggestions([
        { id: 'fallback-1', text: 'What can you help me with?' },
        { id: 'fallback-2', text: 'Tell me about yourself' },
        { id: 'fallback-3', text: 'How do I get started?' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const refetchSuggestions = () => {
    fetchSuggestions();
  };

  useEffect(() => {
    if (autoFetch) {
      fetchSuggestions();
    }
    // eslint-disable-next-line
  }, [category, limit, autoFetch]);

  return {
    suggestions,
    isLoading,
    error,
    categories,
    fetchSuggestions,
    refetchSuggestions,
  };
};
