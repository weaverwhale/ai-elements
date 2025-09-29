import type { LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
// import { groq } from '@ai-sdk/groq';
// import { deepseek } from '@ai-sdk/deepseek';
import { cerebras } from '@ai-sdk/cerebras';
// import { google } from '@ai-sdk/google';
// import { createVertex } from '@ai-sdk/google-vertex';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { defaultSystemPrompt } from './prompts';

// const vertex = createVertex({
//   project: 'shofifi',
//   location: 'us-east5',
// });

const lmstudio = createOpenAICompatible({
  name: 'lmstudio',
  baseURL: 'http://localhost:1234/v1',
});

export interface ModelProvider {
  id: string;
  name: string;
  available: boolean;
  model: LanguageModel;
  defaultSystemPrompt: string;
}

const checkApiKey = (key: string | undefined, provider: string): boolean => {
  const exists = !!key;
  if (!exists) {
    console.warn(`[API] ${provider}_API_KEY is not set in environment variables`);
  }
  return exists;
};

export const modelProviders: ModelProvider[] = [
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini (OpenAI)',
    available: checkApiKey(process.env.OPENAI_API_KEY, 'OPENAI'),
    model: openai('gpt-4.1-mini'),
    defaultSystemPrompt,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1 (OpenAI)',
    available: checkApiKey(process.env.OPENAI_API_KEY, 'OPENAI'),
    model: openai('gpt-4.1'),
    defaultSystemPrompt,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini (OpenAI)',
    available: checkApiKey(process.env.OPENAI_API_KEY, 'OPENAI'),
    model: openai('gpt-5-mini'),
    defaultSystemPrompt,
  },
  {
    id: 'gpt-5',
    name: 'GPT-5 (OpenAI)',
    available: checkApiKey(process.env.OPENAI_API_KEY, 'OPENAI'),
    model: openai('gpt-5'),
    defaultSystemPrompt,
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet (Anthropic)',
    available: checkApiKey(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC'),
    model: anthropic('claude-3-7-sonnet-latest'),
    defaultSystemPrompt,
  },
  {
    id: 'claude-4-sonnet',
    name: 'Claude 4 Sonnet (Anthropic)',
    available: checkApiKey(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC'),
    model: anthropic('claude-sonnet-4-20250514'),
    defaultSystemPrompt,
  },
  {
    id: 'claude-4.1-opus',
    name: 'Claude 4.1 Opus (Anthropic)',
    available: checkApiKey(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC'),
    model: anthropic('claude-4.1-opus'),
    defaultSystemPrompt,
  },
  // {
  //   id: 'claude-brocade-eap',
  //   name: 'Claude Brocade EAP (Anthropic)',
  //   available: checkApiKey(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC'),
  //   model: anthropic('claude-brocade-eap'),
  //   defaultSystemPrompt,
  // },
  {
    id: 'claude-4.5-sonnet',
    name: 'Claude 4.5 Sonnet (Anthropic)',
    available: checkApiKey(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC'),
    model: anthropic('claude-sonnet-4-5-20250929'),
    defaultSystemPrompt,
  },
  // {
  //   id: 'groq-qwen-2.5-32b',
  //   name: 'Qwen 2.5 32B (Groq)',
  //   available: checkApiKey(process.env.GROQ_API_KEY, 'GROQ'),
  //   model: groq('qwen-2.5-32b'),
  //   defaultSystemPrompt,
  // },
  // {
  //   id: 'groq-gemma-2-9b-it',
  //   name: 'Gemma 2 9B (Groq)',
  //   available: checkApiKey(process.env.GROQ_API_KEY, 'GROQ'),
  //   model: groq('gemma2-9b-it'),
  //   defaultSystemPrompt,
  // },
  // {
  //   id: 'deepseek-chat',
  //   name: 'DeepSeek Chat (DeepSeek)',
  //   available: checkApiKey(process.env.DEEPSEEK_API_KEY, 'DEEPSEEK'),
  //   model: deepseek('deepseek-chat'),
  //   defaultSystemPrompt:
  //     'You are a helpful AI assistant powered by DeepSeek. You can help with getting information about weather and location, and telling the current time.',
  // },
  {
    id: 'gpt-oss-120b',
    name: 'GPT-OSS 120B (Groq)',
    available: checkApiKey(process.env.CEREBRAS_API_KEY, 'CEREBRAS'),
    model: cerebras('gpt-oss-120b'),
    defaultSystemPrompt,
  },
  // {
  //   id: 'cerebras-llama-3-3-70b',
  //   name: 'Llama 3.3 70B (Cerebras)',
  //   available: checkApiKey(process.env.CEREBRAS_API_KEY, 'CEREBRAS'),
  //   model: cerebras('llama-3.3-70b'),
  //   defaultSystemPrompt,
  // },
  // {
  //   id: 'qwen-3-32b',
  //   name: 'Qwen 3 32B (Cerebras)',
  //   available: checkApiKey(process.env.CEREBRAS_API_KEY, 'CEREBRAS'),
  //   model: cerebras('qwen-3-32b'),
  //   defaultSystemPrompt,
  // },
  // {
  //   id: 'gemini-flash',
  //   name: 'Gemini 2.5 Flash (Google)',
  //   available: checkApiKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY, 'GEMINI'),
  //   model: google('gemini-2.5-flash-001'),
  //   defaultSystemPrompt,
  // },
  // {
  //   id: 'gemini-2.5-pro-exp-05-06',
  //   name: 'Gemini 2.5 Pro (Google)',
  //   available: checkApiKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY, 'GEMINI'),
  //   model: google('gemini-2.5-pro-exp-05-06'),
  //   defaultSystemPrompt,
  // },
  // {
  //   id: 'gemini-vertex',
  //   name: 'Gemini 2.5 Flash (Vertex)',
  //   available: true,
  //   model: vertex('gemini-2.5-flash-001'),
  //   defaultSystemPrompt,
  // },
  // {
  //   id: 'gemma-3-4b-it-qat',
  //   name: 'Gemma 3 4B (LMStudio)',
  //   available: true,
  //   model: lmstudio('gemma-3-4b-it-qat'),
  //   defaultSystemPrompt,
  // },
  ...(process.env.NODE_ENV !== 'production'
    ? [
        {
          id: 'qwen3-1.7b',
          name: 'Qwen 3.1 1.7B (LMStudio)',
          available: true,
          model: lmstudio('qwen3-1.7b'),
          defaultSystemPrompt,
        },
        {
          id: 'mistral-nemo-instruct-2407',
          name: 'Mistral Nemo Instruct (LMStudio)',
          available: true,
          model: lmstudio('mistral-nemo-instruct-2407'),
          defaultSystemPrompt,
        },
        {
          id: 'gemma-3-4b-it-abliterated-v2',
          name: 'Gemma 3 4B Abliterated V2 (LMStudio)',
          available: true,
          model: lmstudio('gemma-3-4b-it-abliterated-v2'),
          defaultSystemPrompt,
        },
        {
          id: 'nanidao-deepseek-r1-qwen-2.5-32b-ablated',
          name: 'Nanidao DeepSeek R1 Qwen 2.5 32B Ablated (LMStudio)',
          available: true,
          model: lmstudio('nanidao-deepseek-r1-qwen-2.5-32b-ablated'),
          defaultSystemPrompt,
        },
        // {
        //   id: 'gpt-oss-20b',
        //   name: 'GPT-OSS 20B (LMStudio)',
        //   available: true,
        //   model: lmstudio('gpt-oss-20b'),
        //   defaultSystemPrompt,
        // },
        {
          id: 'huihui-gpt-oss-20b-abliterated',
          name: 'GPT-OSS 20B Abliterated (LMStudio)',
          available: true,
          model: lmstudio('huihui-gpt-oss-20b-abliterated'),
          defaultSystemPrompt,
        },
      ]
    : []),
];

export function getModelProviderById(id: string): ModelProvider | undefined {
  return modelProviders.find((provider) => provider.id === id);
}

export function getAvailableModelProviders(): ModelProvider[] {
  return modelProviders.filter((provider) => provider.available);
}
