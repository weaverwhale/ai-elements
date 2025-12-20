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
import { useEffect, useState, useCallback, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import type { ToolUIPart } from 'ai';
import { Response } from '@/components/ai-elements/response';
import { Button } from '@/components/ui/button';
import { SquarePen, RefreshCcwIcon, CopyIcon } from 'lucide-react';
import { SearchableConversationDropdown } from '@/components/ai-elements/conversations';
import { ModeToggleButton } from '@/components/ui/mode-toggle';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/source';
import { Actions, Action } from '@/components/ai-elements/actions';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { ThinkingIndicator } from '@/components/ai-elements/thinking-indicator';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { useModels } from '@/hooks/useModels';
import { useToolOptions } from '@/hooks/useToolOptions';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useConversations } from '@/hooks/useConversations';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';

export const Chatbot = () => {
  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status, setMessages, regenerate } = useChat();
  const { availableModels, selectedModel, setSelectedModel, fetchModels } =
    useModels();
  const toolOptions = useToolOptions();
  const { suggestions, isLoading } = useSuggestions();
  const {
    conversations,
    currentConversation,
    currentConversationId,
    isLoadingConversation,
    saveConversation,
    loadConversation,
    clearCurrentConversation,
    startNewConversation,
    deleteConversation,
  } = useConversations();

  const availableConversations = conversations.filter(
    conv => conv.id !== currentConversationId
  );

  const getToolDisplayName = (toolType: string) => {
    const toolId = toolType.startsWith('tool-') ? toolType.slice(5) : toolType;

    const toolInfo = toolOptions[toolId];
    if (toolInfo && toolInfo.name) {
      return toolInfo.name;
    }

    return toolId
      .replace(/([A-Z])/g, ' $1')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      // If this is the first message and we don't have a current conversation, start a new one
      if (messages.length === 0 && !currentConversationId) {
        startNewConversation();
      }

      sendMessage(
        { text: input },
        {
          body: {
            modelId: selectedModel,
          },
        }
      );
      setInput('');
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    clearCurrentConversation();
  };

  const handleLoadConversation = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;

      try {
        const conversation = await loadConversation(conversationId);
        if (conversation) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMessages(conversation.messages as any);
          setSelectedModel(conversation.modelId);
        }
      } catch (err) {
        console.error('Failed to load conversation:', err);
      }
    },
    [loadConversation, setMessages, setSelectedModel]
  );

  const handleSuggestionClick = (suggestion: string) => {
    // If this is the first message and we don't have a current conversation, start a new one
    if (messages.length === 0 && !currentConversationId) {
      startNewConversation();
    }

    sendMessage(
      { text: suggestion },
      {
        body: {
          modelId: selectedModel,
        },
      }
    );
  };

  const handleDeleteConversation = (
    e: React.MouseEvent,
    conversationId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    deleteConversation(conversationId);
  };

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Focus the input on component mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-load conversation from URL when currentConversationId changes
  useEffect(() => {
    if (
      currentConversationId &&
      (!currentConversation || currentConversation.id !== currentConversationId)
    ) {
      handleLoadConversation(currentConversationId);
    }
  }, [currentConversationId, currentConversation, handleLoadConversation]);

  // Auto-save conversation when messages change
  useEffect(() => {
    if (
      messages.length > 0 &&
      status !== 'streaming' &&
      !isLoadingConversation
    ) {
      // Only save if we have at least one complete exchange (user + assistant)
      const hasCompleteExchange = messages.some(m => m.role === 'assistant');
      if (hasCompleteExchange) {
        setIsSaving(true);
        saveConversation(messages, selectedModel)
          .catch(err => {
            console.error('Failed to auto-save conversation:', err);
          })
          .finally(() => {
            setTimeout(() => setIsSaving(false), 1000); // Show save indicator for 1 second
          });
      }
    }
  }, [
    messages,
    selectedModel,
    status,
    isLoadingConversation,
    saveConversation,
  ]);

  return (
    <div className="relative size-full h-dvh">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent className="max-w-4xl mx-auto px-2">
            {messages.map((message, index) => (
              <div key={message.id}>
                {message.role === 'assistant' &&
                  message.parts.find(part => part.type === 'source-url') && (
                    <Sources>
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case 'source-url':
                            return (
                              <>
                                <SourcesTrigger
                                  count={
                                    message.parts.filter(
                                      part => part.type === 'source-url'
                                    ).length
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
                        case 'text': {
                          return (
                            <div key={`${message.id}-${i}`}>
                              <Response
                                isStreaming={
                                  status === 'streaming' &&
                                  index === messages.length - 1
                                }
                              >
                                {part.text}
                              </Response>
                            </div>
                          );
                        }
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
                                  displayName={getToolDisplayName(
                                    toolPart.type
                                  )}
                                />
                                <ToolContent>
                                  <ToolInput input={toolPart.input} />
                                  <ToolOutput
                                    output={
                                      toolPart.output ? (
                                        <Response
                                          isStreaming={
                                            status === 'streaming' &&
                                            index === messages.length - 1
                                          }
                                        >
                                          {typeof toolPart.output === 'string'
                                            ? toolPart.output
                                            : JSON.stringify(
                                                toolPart.output,
                                                null,
                                                2
                                              )}
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
                {message.role === 'assistant' &&
                  index === messages.length - 1 &&
                  status !== 'streaming' && (
                    <Actions>
                      <Action
                        className="cursor-pointer"
                        onClick={() => regenerate()}
                        label="Retry"
                      >
                        <RefreshCcwIcon className="size-3" />
                      </Action>
                      <Action
                        className="cursor-pointer"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            message.parts
                              .filter(part => part.type === 'text')
                              .map(part => part.text)
                              .join('\n')
                          )
                        }
                        label="Copy"
                      >
                        <CopyIcon className="size-3" />
                      </Action>
                    </Actions>
                  )}
              </div>
            ))}
            {status === 'submitted' && <ThinkingIndicator />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {messages.length === 0 && (
          <Suggestions className="max-w-4xl mx-auto overflow-x-auto pb-2 no-scrollbar">
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Suggestion
                    key={`placeholder-${index}`}
                    suggestion=""
                    className="animate-pulse pointer-events-none"
                    index={index}
                    length={6}
                  >
                    <div className="h-3 bg-muted-foreground/30 rounded w-40"></div>
                  </Suggestion>
                ))
              : suggestions.map((suggestion, index) => (
                  <Suggestion
                    key={suggestion.id}
                    onClick={handleSuggestionClick}
                    suggestion={suggestion.text}
                    index={index}
                    length={suggestions.length}
                  />
                ))}
          </Suggestions>
        )}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            ref={textareaRef}
            onChange={e => setInput(e.target.value)}
            value={input}
          />
          <PromptInputToolbar className="flex gap-2 p-2">
            <div className="flex items-center gap-2 overflow-scroll">
              <Button
                onClick={handleNewConversation}
                variant="outline"
                size="icon"
                disabled={messages.length === 0}
                className="cursor-pointer"
                title="New Conversation"
              >
                <SquarePen />
              </Button>

              <SearchableConversationDropdown
                conversations={availableConversations}
                onSelectConversation={handleLoadConversation}
                onDeleteConversation={handleDeleteConversation}
                isLoading={isLoading}
                isSaving={isSaving}
              />

              <ModeToggleButton />

              <PromptInputTools>
                <PromptInputModelSelect
                  onValueChange={value => {
                    setSelectedModel(value);
                  }}
                  value={selectedModel}
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {availableModels.map(model => (
                      <PromptInputModelSelectItem
                        key={model.id}
                        value={model.id}
                      >
                        {model.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
            </div>
            <PromptInputSubmit disabled={!input} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};
