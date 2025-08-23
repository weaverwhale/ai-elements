import { generateText, streamText, type UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { getModelProviderById } from '../modelProviders';
import { tools, geminiTools } from '../tools';
import { ChatMessage, storeChatToMemory, searchChatMemory } from '../chatMemory';

const DEFAULT_MODEL_ID = 'gpt-4.1-mini';

interface ChatRequest {
  messages: UIMessage[];
  modelId?: string;
  stream?: boolean;
  userId?: string;
}

// Helper function to extract text content from UIMessage parts
function extractTextContent(message: UIMessage): string {
  return (
    message.parts
      ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      ?.map((part) => part.text)
      ?.join('') || ''
  );
}

// Helper function to convert UIMessage to ChatMessage
function convertToChatMessageFormat(messages: UIMessage[]): ChatMessage[] {
  return messages.map((msg) => ({
    role:
      msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system'
        ? msg.role
        : 'system',
    content: extractTextContent(msg),
    ...(msg.id ? { id: msg.id } : {}),
  })) as ChatMessage[];
}

// Helper function to search and filter memories
async function getRelevantMemories(
  userId: string,
  query: string,
  recentMessages: UIMessage[],
): Promise<string> {
  if (userId === 'anonymous' || !query) {
    return '';
  }

  try {
    console.log(`[Memory] Searching for user ${userId} with query: ${query.substring(0, 50)}...`);

    const memorySearchResult = await searchChatMemory(userId, query, 5);
    let memories: { content: string }[] = [];

    // Handle different response types from searchChatMemory
    if (typeof memorySearchResult === 'string') {
      try {
        memories = JSON.parse(memorySearchResult);
      } catch {
        return '';
      }
    } else if (Array.isArray(memorySearchResult)) {
      memories = memorySearchResult;
    } else if (memorySearchResult?.results && Array.isArray(memorySearchResult.results)) {
      memories = memorySearchResult.results;
    }

    if (!Array.isArray(memories) || memories.length === 0) {
      return '';
    }

    // Get recent message content to avoid duplication
    const recentContent = new Set<string>();
    recentMessages.slice(-6).forEach((msg) => {
      const content = extractTextContent(msg).trim();
      if (content) recentContent.add(content);
    });

    // Filter memories
    const filteredMemories = memories.filter((memory) => {
      if (!memory?.content || typeof memory.content !== 'string') {
        return false;
      }

      const contentParts = memory.content.split(': ');
      if (contentParts.length < 2) return false;

      const role = contentParts[0];
      const content = contentParts.slice(1).join(': ').trim();

      if (!content) return false;

      // Skip recent duplicates
      if (recentContent.has(content)) return false;

      // Skip assistant tool responses
      if (role === 'assistant' && (content.includes('✅') || content.includes('Calling'))) {
        return false;
      }

      return true;
    });

    if (filteredMemories.length === 0) {
      return '';
    }

    console.log(`[Memory] Found ${filteredMemories.length} relevant memories`);

    const memoryItems = filteredMemories.map((memory) => `- ${memory.content}`).join('\n');

    return `\n\nRelevant information from previous conversations:\n${memoryItems}`;
  } catch (error) {
    console.error('[Memory] Error searching memories:', error);
    return '';
  }
}

// Helper function to store chat to memory with timeout
async function storeToMemoryAsync(userId: string, messages: UIMessage[]): Promise<void> {
  if (userId === 'anonymous') return;

  try {
    const chatMessages = convertToChatMessageFormat(messages);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Memory storage timeout')), 5000);
    });

    await Promise.race([storeChatToMemory(userId, chatMessages), timeoutPromise]);
  } catch (error) {
    console.error('[Memory] Error storing chat:', error);
  }
}

export async function handleChatRequest(body: ChatRequest) {
  try {
    const isStream = body.stream !== false;
    const modelId = body.modelId || DEFAULT_MODEL_ID;
    const userId = body.userId?.trim() || 'anonymous';

    const modelProvider = getModelProviderById(modelId);
    if (!modelProvider) {
      throw new Error(`Model provider '${modelId}' not found`);
    }
    if (!modelProvider.available) {
      throw new Error(`Model provider '${modelId}' is not available. API key might be missing.`);
    }

    // Get memory context if user has messages
    let memoryContext = '';
    if (body.messages.length > 0) {
      const lastUserMessage = [...body.messages].reverse().find((msg) => msg.role === 'user');

      if (lastUserMessage) {
        const query = extractTextContent(lastUserMessage);
        memoryContext = await getRelevantMemories(userId, query, body.messages);
      }
    }

    // Create system prompt with memory context
    const systemPrompt =
      modelProvider.defaultSystemPrompt +
      memoryContext +
      (modelId.includes('qwen') ? '\n\n/no_think' : '');

    const messagesWithSystem: UIMessage[] = [
      {
        role: 'system',
        id: `system-${Date.now()}`,
        parts: [{ type: 'text', text: systemPrompt }],
      } as UIMessage,
      ...body.messages,
    ];

    // Generate response based on stream preference
    const model = modelProvider.model;
    const modelMessages = convertToModelMessages(messagesWithSystem);
    const commonOptions = {
      model,
      tools: modelId.includes('gemini') ? geminiTools : tools,
      messages: modelMessages,
      maxOutputTokens: 5000,
      stopWhen: stepCountIs(10),
    };

    // Store to memory in background (non-blocking)
    storeToMemoryAsync(userId, body.messages).catch((err) =>
      console.error('[API] Background memory storage failed:', err),
    );

    if (isStream) {
      const result = streamText(commonOptions);
      console.log('[API] StreamText result created successfully');

      return result.toUIMessageStreamResponse({
        sendSources: true,
        sendReasoning: true,
      });
    } else {
      const result = await generateText(commonOptions);
      return result;
    }
  } catch (error) {
    console.error('[API] Chat request error:', error);
    throw error;
  }
}
