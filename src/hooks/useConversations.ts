import { useState, useEffect, useCallback } from 'react';
import type { UIMessage } from 'ai';
import { SavedConversation, ConversationSummary } from '../types/chatTypes';

const STORAGE_KEY = 'saved-conversations';
const MAX_CONVERSATIONS = 50; // Limit to prevent localStorage overflow

interface UseConversationsResult {
  conversations: ConversationSummary[];
  currentConversation: SavedConversation | null;
  currentConversationId: string | null;
  isLoadingConversation: boolean;
  saveConversation: (messages: UIMessage[], modelId: string, title?: string) => Promise<string>;
  loadConversation: (conversationId: string) => Promise<SavedConversation | null>;
  loadConversationFromUrl: () => void;
  deleteConversation: (conversationId: string) => void;
  clearAllConversations: () => void;
  clearCurrentConversation: () => void;
  startNewConversation: () => string;
  updateConversationTitle: (conversationId: string, newTitle: string) => void;
  generateTitle: (messages: UIMessage[]) => string;
  setCurrentConversationId: (id: string | null) => void;
  isLoading: boolean;
  error: string | null;
}

// Helper function to generate a conversation title from the first user message
function generateConversationTitle(messages: UIMessage[]): string {
  const firstUserMessage = messages.find((msg) => msg.role === 'user');
  if (!firstUserMessage?.parts?.length) return 'New Conversation';

  const textPart = firstUserMessage.parts.find((part) => part.type === 'text');
  if (!textPart || !('text' in textPart)) return 'New Conversation';

  const text = textPart.text.trim();
  if (text.length === 0) return 'New Conversation';

  // Truncate to reasonable length and clean up
  return text.length > 50 ? `${text.substring(0, 50)}...` : text;
}

// Helper function to deserialize dates from localStorage
function deserializeConversation(serialized: string): SavedConversation {
  const parsed = JSON.parse(serialized);
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
  };
}

// Helper functions for URL parameter management
function getConversationIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('conversation');
}

function setConversationIdInUrl(conversationId: string | null): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (conversationId) {
    url.searchParams.set('conversation', conversationId);
  } else {
    url.searchParams.delete('conversation');
  }

  // Update URL without causing page reload
  window.history.replaceState({}, '', url.toString());
}

export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] = useState<SavedConversation | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load conversations from localStorage on mount and check URL for conversation ID
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedConversations = JSON.parse(stored);
        const summaries: ConversationSummary[] = parsedConversations.map(
          (conv: SavedConversation) => ({
            id: conv.id,
            title: conv.title,
            messageCount: conv.messages?.length || 0,
            modelId: conv.modelId,
            createdAt: new Date(conv.createdAt),
            updatedAt: new Date(conv.updatedAt),
          }),
        );

        // Sort by most recently updated
        summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        setConversations(summaries);
      }

      // Check URL for conversation ID
      const urlConversationId = getConversationIdFromUrl();
      if (urlConversationId) {
        setCurrentConversationId(urlConversationId);
      }
    } catch (err) {
      console.error('Failed to load conversations from storage:', err);
      setError('Failed to load saved conversations');
    }
  }, []);

  const saveConversation = useCallback(
    async (messages: UIMessage[], modelId: string, title?: string): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const now = new Date();
        const conversationTitle = title || generateConversationTitle(messages);

        // Get existing conversations from storage to find current conversation
        const stored = localStorage.getItem(STORAGE_KEY);
        const existingConversations: SavedConversation[] = stored
          ? JSON.parse(stored).map((conv: SavedConversation) =>
              deserializeConversation(JSON.stringify(conv)),
            )
          : [];

        // Find existing conversation - use current ID if available, otherwise look by message matching
        let conversationId: string;
        let existingConversation: SavedConversation | undefined;

        if (currentConversationId) {
          // Use the current conversation ID if we have one
          conversationId = currentConversationId;
          existingConversation = existingConversations.find(
            (conv) => conv.id === currentConversationId,
          );
        } else {
          // Find existing conversation by checking if messages match (for updates)
          existingConversation = existingConversations.find(
            (conv) =>
              conv.messages.length > 0 &&
              messages.length > 0 &&
              conv.messages[0]?.id === messages[0]?.id,
          );

          if (existingConversation) {
            conversationId = existingConversation.id;
          } else {
            conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
        }

        const conversation: SavedConversation = {
          id: conversationId,
          title: conversationTitle,
          messages,
          modelId,
          createdAt: existingConversation?.createdAt || now,
          updatedAt: now,
        };

        // Update or add the conversation
        const existingIndex = existingConversations.findIndex((conv) => conv.id === conversationId);
        if (existingIndex >= 0) {
          existingConversations[existingIndex] = conversation;
        } else {
          existingConversations.unshift(conversation);
        }

        // Limit the number of stored conversations
        const trimmedConversations = existingConversations.slice(0, MAX_CONVERSATIONS);

        // Save back to localStorage
        const serialized = trimmedConversations.map((conv) => {
          const { createdAt, updatedAt, ...rest } = conv;
          return {
            ...rest,
            createdAt: createdAt.toISOString(),
            updatedAt: updatedAt.toISOString(),
          };
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));

        // Update state
        const summaries: ConversationSummary[] = trimmedConversations.map((conv) => ({
          id: conv.id,
          title: conv.title,
          messageCount: conv.messages.length,
          modelId: conv.modelId,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        }));

        setConversations(summaries);
        setCurrentConversation(conversation);
        setCurrentConversationId(conversationId);

        // Update URL with conversation ID
        setConversationIdInUrl(conversationId);

        return conversationId;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save conversation';
        setError(errorMessage);
        console.error('Failed to save conversation:', err);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversationId],
  );

  const loadConversation = useCallback(
    async (conversationId: string): Promise<SavedConversation | null> => {
      setIsLoadingConversation(true);
      setError(null);

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const conversations = JSON.parse(stored);
        const conversationData = conversations.find(
          (conv: SavedConversation) => conv.id === conversationId,
        );

        if (!conversationData) {
          setError('Conversation not found');
          return null;
        }

        const conversation = deserializeConversation(JSON.stringify(conversationData));
        setCurrentConversation(conversation);
        setCurrentConversationId(conversationId);

        // Update URL with conversation ID
        setConversationIdInUrl(conversationId);

        return conversation;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load conversation';
        setError(errorMessage);
        console.error('Failed to load conversation:', err);
        return null;
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [],
  );

  const deleteConversation = useCallback(
    (conversationId: string) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;

        const conversations = JSON.parse(stored);
        const filtered = conversations.filter(
          (conv: SavedConversation) => conv.id !== conversationId,
        );

        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

        // Update state
        setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));

        if (currentConversationId === conversationId) {
          setCurrentConversation(null);
          setCurrentConversationId(null);
          setConversationIdInUrl(null);
        }
      } catch (err) {
        console.error('Failed to delete conversation:', err);
        setError('Failed to delete conversation');
      }
    },
    [currentConversationId],
  );

  const clearAllConversations = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setConversations([]);
      setCurrentConversation(null);
      setCurrentConversationId(null);
      setConversationIdInUrl(null);
    } catch (err) {
      console.error('Failed to clear conversations:', err);
      setError('Failed to clear conversations');
    }
  }, []);

  const clearCurrentConversation = useCallback(() => {
    setCurrentConversation(null);
    setCurrentConversationId(null);
    setConversationIdInUrl(null);
  }, []);

  const startNewConversation = useCallback(() => {
    const newConversationId = `${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    setCurrentConversation(null);
    setCurrentConversationId(newConversationId);
    setConversationIdInUrl(newConversationId);
    return newConversationId;
  }, []);

  const loadConversationFromUrl = useCallback(() => {
    const urlConversationId = getConversationIdFromUrl();
    if (urlConversationId && urlConversationId !== currentConversationId) {
      setCurrentConversationId(urlConversationId);
    }
  }, [currentConversationId]);

  const updateConversationTitle = useCallback(
    (conversationId: string, newTitle: string) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;

        const conversations = JSON.parse(stored);
        const conversation = conversations.find(
          (conv: SavedConversation) => conv.id === conversationId,
        );

        if (conversation) {
          conversation.title = newTitle;
          conversation.updatedAt = new Date().toISOString();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));

          // Update state
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId
                ? { ...conv, title: newTitle, updatedAt: new Date() }
                : conv,
            ),
          );

          if (currentConversation?.id === conversationId) {
            setCurrentConversation((prev) => (prev ? { ...prev, title: newTitle } : null));
          }
        }
      } catch (err) {
        console.error('Failed to update conversation title:', err);
        setError('Failed to update conversation title');
      }
    },
    [currentConversation],
  );

  const generateTitle = useCallback((messages: UIMessage[]): string => {
    return generateConversationTitle(messages);
  }, []);

  return {
    conversations,
    currentConversation,
    currentConversationId,
    isLoadingConversation,
    saveConversation,
    loadConversation,
    loadConversationFromUrl,
    deleteConversation,
    clearAllConversations,
    clearCurrentConversation,
    startNewConversation,
    updateConversationTitle,
    generateTitle,
    setCurrentConversationId,
    isLoading,
    error,
  };
}
