import {
  ToolLoopAgent,
  type UIMessage,
  stepCountIs,
  createAgentUIStreamResponse,
  convertToModelMessages,
} from 'ai';
import { tools, geminiTools } from '../tools';
import { getModelProviderById } from '../utils/modelProviders';
import { getRelevantMemories, storeToMemoryAsync } from '../utils/chatMemory';
import { extractTextContent } from '../utils/text';

const DEFAULT_MODEL_ID = 'gpt-4.1-mini';

interface ChatRequest {
  messages: UIMessage[];
  modelId?: string;
  stream?: boolean;
  userId?: string;
}

// Agent factory function
async function getAgent(
  modelId: string,
  userId: string,
  messages: UIMessage[]
) {
  const modelProvider = getModelProviderById(modelId);
  if (!modelProvider) {
    throw new Error(`Model provider '${modelId}' not found`);
  }
  if (!modelProvider.available) {
    throw new Error(
      `Model provider '${modelId}' is not available. API key might be missing.`
    );
  }

  // Get memory context if user has messages
  let memoryContext = '';
  if (messages.length > 0) {
    const lastUserMessage = [...messages]
      .reverse()
      .find(msg => msg.role === 'user');

    if (lastUserMessage) {
      const query = extractTextContent(lastUserMessage);
      memoryContext = await getRelevantMemories(userId, query, messages);
    }
  }

  // Create system prompt with memory context
  const systemPrompt =
    modelProvider.defaultSystemPrompt +
    memoryContext +
    (modelId.includes('qwen') ? '\n\n/no_think' : '');

  // Select appropriate tools
  const selectedTools = modelId.includes('gemini') ? geminiTools : tools;

  // Create and return agent
  return new ToolLoopAgent({
    model: modelProvider.model,
    instructions: systemPrompt,
    tools: selectedTools,
    stopWhen: stepCountIs(10),
  });
}

export async function handleChatRequest(body: ChatRequest) {
  try {
    const isStream = body.stream !== false;
    const modelId = body.modelId || DEFAULT_MODEL_ID;
    const userId = body.userId?.trim() || 'anonymous';

    // Get configured agent
    const agent = await getAgent(modelId, userId, body.messages);

    // Store to memory in background (non-blocking)
    storeToMemoryAsync(userId, body.messages).catch(err =>
      console.error('[API] Background memory storage failed:', err)
    );

    if (isStream) {
      console.log('[API] Creating agent stream response');

      return createAgentUIStreamResponse({
        agent,
        uiMessages: body.messages,
      });
    } else {
      // For non-streaming, use agent.generate() with messages
      console.log('[API] Generating agent response');

      const modelMessages = await convertToModelMessages(body.messages);

      const result = await agent.generate({
        messages: modelMessages,
      });

      return result;
    }
  } catch (error) {
    console.error('[API] Chat request error:', error);
    throw error;
  }
}
