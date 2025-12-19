import { Request, Response } from 'express';

interface SuggestionItem {
  id: string;
  text: string;
  category?: string;
}

// Predefined suggestions for the chat
const DEFAULT_SUGGESTIONS: SuggestionItem[] = [
  {
    id: 'ai-trends',
    text: 'What are the latest trends in AI?',
    category: 'AI & Technology',
  },
  {
    id: 'machine-learning',
    text: 'How does machine learning work?',
    category: 'AI & Technology',
  },
  {
    id: 'quantum-computing',
    text: 'Explain quantum computing',
    category: 'Technology',
  },
  {
    id: 'react-best-practices',
    text: 'Best practices for React development',
    category: 'Programming',
  },
  {
    id: 'typescript-benefits',
    text: 'Tell me about TypeScript benefits',
    category: 'Programming',
  },
  {
    id: 'database-optimization',
    text: 'How to optimize database queries?',
    category: 'Programming',
  },
  {
    id: 'sql-nosql',
    text: 'What is the difference between SQL and NoSQL?',
    category: 'Database',
  },
  {
    id: 'cloud-computing',
    text: 'Explain cloud computing basics',
    category: 'Technology',
  },
  {
    id: 'web-dev-trends',
    text: 'What are the current web development trends?',
    category: 'Programming',
  },
  {
    id: 'api-design',
    text: 'How to design RESTful APIs?',
    category: 'Programming',
  },
  {
    id: 'roas',
    text: 'What is my ROAS for the past 30 days?',
    category: 'Business',
  },
  {
    id: 'business-health',
    text: 'How is my business doing?',
    category: 'Business',
  },
  {
    id: 'marketing-strategy',
    text: 'What is my marketing strategy?',
    category: 'Business',
  },
  {
    id: 'news-today',
    text: 'What are the latest news today?',
    category: 'News',
  },
  {
    id: 'weather-today',
    text: 'What is the weather today in Columbus, OH?',
    category: 'Weather',
  },
];

export const handleSuggestionsRequest = async (req: Request, res: Response) => {
  try {
    // You can add query parameters for filtering by category, limit, etc.
    const { category, limit = 6 } = req.query;

    let suggestions = DEFAULT_SUGGESTIONS;

    // Filter by category if provided
    if (category && typeof category === 'string') {
      suggestions = suggestions.filter(s =>
        s.category?.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Apply limit
    const limitNum = parseInt(limit as string);
    if (!isNaN(limitNum) && limitNum > 0) {
      suggestions = suggestions.slice(0, limitNum);
    }

    // Shuffle suggestions to provide variety
    const shuffledSuggestions = [...suggestions].sort(
      () => Math.random() - 0.5
    );

    res.json({
      suggestions: shuffledSuggestions,
      total: suggestions.length,
      categories: [
        ...new Set(DEFAULT_SUGGESTIONS.map(s => s.category).filter(Boolean)),
      ],
    });
  } catch (error) {
    console.error('[SERVER] Error getting suggestions:', error);
    res.status(500).json({
      error: 'Failed to fetch suggestions',
      suggestions: DEFAULT_SUGGESTIONS.slice(0, 6), // Fallback suggestions
    });
  }
};
