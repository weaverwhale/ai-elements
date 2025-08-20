import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { ToolUIPart } from 'ai';
import { Response } from '@/components/ai-elements/response';
import { Button } from '@/components/ui/button';
import { SquarePen } from 'lucide-react';
import { ModeToggleButton } from '@/components/ui/mode-toggle';
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/source';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Loader } from '@/components/ai-elements/loader';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { useModels } from '@/hooks/useModels';
import { useToolOptions } from '@/hooks/useToolOptions';

export const Chatbot = () => {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, setMessages } = useChat();
  const { availableModels, selectedModel, setSelectedModel, fetchModels } = useModels();
  const toolOptions = useToolOptions();

  // Function to format tool type to display name
  const getToolDisplayName = (toolType: string) => {
    // Remove "tool-" prefix if it exists
    const toolId = toolType.startsWith('tool-') ? toolType.slice(5) : toolType;

    // Look up the tool name from our tool options
    const toolInfo = toolOptions[toolId];
    if (toolInfo && toolInfo.name) {
      return toolInfo.name;
    }

    // Fallback: convert camelCase or kebab-case to Title Case
    return toolId
      .replace(/([A-Z])/g, ' $1')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(
        { text: input },
        {
          body: {
            model: selectedModel,
          },
        },
      );
      setInput('');
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
  };

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return (
    <div className="max-w-4xl mx-auto p-6 pt-0 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-2">
          <Button
            onClick={handleNewConversation}
            variant="outline"
            size="icon"
            disabled={messages.length === 0}
            title="New Conversation"
          >
            <SquarePen />
          </Button>
          <ModeToggleButton />
        </div>

        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'assistant' && (
                  <Sources>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case 'source-url':
                          return (
                            <>
                              <SourcesTrigger
                                count={
                                  message.parts.filter((part) => part.type === 'source-url').length
                                }
                              />
                              <SourcesContent key={`${message.id}-${i}`}>
                                <Source
                                  key={`${message.id}-${i}`}
                                  href={part.url}
                                  title={part.url}
                                />
                              </SourcesContent>
                            </>
                          );
                      }
                    })}
                  </Sources>
                )}
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case 'text':
                          return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                        case 'reasoning':
                          return (
                            <Reasoning
                              key={`${message.id}-${i}`}
                              className="w-full"
                              isStreaming={status === 'streaming'}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          );
                        default:
                          // Handle tool calls - AI SDK tool parts have types that start with "tool-"
                          if (part.type.startsWith('tool-')) {
                            const toolPart = part as ToolUIPart;
                            return (
                              <Tool
                                key={`${message.id}-${i}`}
                                defaultOpen={
                                  toolPart.state === 'output-available' ||
                                  toolPart.state === 'output-error'
                                }
                              >
                                <ToolHeader
                                  type={toolPart.type}
                                  state={toolPart.state}
                                  displayName={getToolDisplayName(toolPart.type)}
                                />
                                <ToolContent>
                                  <ToolInput input={toolPart.input} />
                                  <ToolOutput
                                    output={
                                      toolPart.output ? (
                                        <Response>
                                          {typeof toolPart.output === 'string'
                                            ? toolPart.output
                                            : JSON.stringify(toolPart.output, null, 2)}
                                        </Response>
                                      ) : undefined
                                    }
                                    errorText={toolPart.errorText}
                                  />
                                </ToolContent>
                              </Tool>
                            );
                          }
                          return null;
                      }
                    })}
                  </MessageContent>
                </Message>
              </div>
            ))}
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="mt-4">
          <PromptInputTextarea onChange={(e) => setInput(e.target.value)} value={input} />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputModelSelect
                onValueChange={(value) => {
                  setSelectedModel(value);
                }}
                value={selectedModel}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {availableModels.map((model) => (
                    <PromptInputModelSelectItem key={model.id} value={model.id}>
                      {model.name}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};
