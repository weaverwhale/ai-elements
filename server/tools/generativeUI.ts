import { z } from 'zod';
import { generateText, ModelMessage } from 'ai';
import { getModelProviderById } from '../modelProviders';
import { generativeUiToolPrompt } from '../prompts';

const UI_GENERATION_MODEL_ID = 'claude-4-sonnet';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
});

type GenerativeUiParams = {
  description: string;
  conversationHistory: ModelMessage[];
};

const generativeUi = {
  id: 'generativeUi',
  name: 'Generative UI',
  description:
    'Generates complete, self-contained React components with hardcoded data based on a description. Creates full functional components with all necessary data defined within the component itself. Uses Tailwind CSS for styling.',
  inputSchema: z.object({
    description: z
      .string()
      .describe(
        'A detailed natural language description of the desired UI component. Should generate a complete React component with all data hardcoded within the component itself. Do NOT generate wrapper components that import other components. Include specific layout, elements, and styling instructions (Tailwind CSS).',
      ),
    conversationHistory: z
      .array(messageSchema) // Validate as an array of messages
      .describe('The history of the conversation leading up to this UI generation request.'),
  }),
  execute: async ({
    description,
    conversationHistory = [],
  }: GenerativeUiParams): Promise<string> => {
    console.log(`[GenerativeUI Tool] Request received.`);

    try {
      const modelProvider = getModelProviderById(UI_GENERATION_MODEL_ID);
      if (!modelProvider || !modelProvider.available) {
        throw new Error(
          `UI Generation model provider '${UI_GENERATION_MODEL_ID}' is not available or configured. Check API keys.`,
        );
      }
      const model = modelProvider.model;
      const messages: ModelMessage[] = [
        { role: 'system', content: generativeUiToolPrompt },
        ...conversationHistory,
        { role: 'user', content: description },
      ];

      const { text } = await generateText({
        model: model,
        messages: messages,
        maxOutputTokens: 10000,
      });

      const generatedCode = text.trim();

      if (!generatedCode) {
        throw new Error('LLM did not return UI content.');
      }

      // Check if it's a complete React component (starts with const/function) or just JSX
      const isComponent =
        generatedCode.startsWith('const ') ||
        generatedCode.startsWith('function ') ||
        generatedCode.includes('=>');

      if (!isComponent && (!generatedCode.startsWith('<') || !generatedCode.endsWith('>'))) {
        console.warn(
          `[GenerativeUI Tool] Output doesn't look like JSX or React component: ${generatedCode.substring(
            0,
            100,
          )}...`,
        );
      }

      console.log(
        `[GenerativeUI Tool] Generated ${
          isComponent ? 'React component' : 'JSX'
        }: ${generatedCode.substring(0, 100)}...`,
      );
      return generatedCode;
    } catch (error) {
      console.error('[GenerativeUI Tool] Error generating UI:', error);
      return `Error generating UI: ${
        error instanceof Error ? error.message : 'An unknown error occurred'
      }`;
    }
  },
};

export { generativeUi };
