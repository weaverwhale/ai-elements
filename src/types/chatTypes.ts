import type { UIMessage } from 'ai';

export interface Model {
  id: string;
  name: string;
}

export interface ToolInfo {
  id: string;
  description: string;
  name: string;
}

export interface SavedConversation {
  id: string;
  title: string;
  messages: UIMessage[];
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
}
