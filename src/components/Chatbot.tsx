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
import { useEffect, useState, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import type { ToolUIPart } from 'ai';
import { Response } from '@/components/ai-elements/response';
import { Button } from '@/components/ui/button';
import { SquarePen, RefreshCcwIcon, CopyIcon, History, Save, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { ModeToggleButton } from '@/components/ui/mode-toggle';
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/source';
import { Actions, Action } from '@/components/ai-elements/actions';
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
import { useSuggestions } from '@/hooks/useSuggestions';
import { useConversations } from '@/hooks/useConversations';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';

export const Chatbot = () => {
  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { messages, sendMessage, status, setMessages, regenerate } = useChat();
  const { availableModels, selectedModel, setSelectedModel, fetchModels } = useModels();
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

  const availableConversations = conversations.filter((conv) => conv.id !== currentConversationId);

  const getToolDisplayName = (toolType: string) => {
    const toolId = toolType.startsWith('tool-') ? toolType.slice(5) : toolType;

    const toolInfo = toolOptions[toolId];
    if (toolInfo && toolInfo.name) {
      return toolInfo.name;
    }

    return toolId
      .replace(/([A-Z])/g, ' $1')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
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
        },
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
          setMessages(conversation.messages);
          setSelectedModel(conversation.modelId);
        }
      } catch (err) {
        console.error('Failed to load conversation:', err);
      }
    },
    [loadConversation, setMessages, setSelectedModel],
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
      },
    );
  };

  const handleDeleteConversation = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteConversation(conversationId);
  };

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

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
    if (messages.length > 0 && status !== 'streaming' && !isLoadingConversation) {
      // Only save if we have at least one complete exchange (user + assistant)
      const hasCompleteExchange = messages.some((m) => m.role === 'assistant');
      if (hasCompleteExchange) {
        setIsSaving(true);
        saveConversation(messages, selectedModel)
          .catch((err) => {
            console.error('Failed to auto-save conversation:', err);
          })
          .finally(() => {
            setTimeout(() => setIsSaving(false), 1000); // Show save indicator for 1 second
          });
      }
    }
  }, [messages, selectedModel, status, isLoadingConversation, saveConversation]);

  return (
    <div className="max-w-4xl mx-auto relative size-full h-[100dvh]">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message, index) => (
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
                        case 'text': {
                          return (
                            <div key={`${message.id}-${i}`}>
                              <Response>{part.text}</Response>
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
                {message.role === 'assistant' &&
                  index === messages.length - 1 &&
                  status !== 'streaming' && (
                    <Actions>
                      <Action className="cursor-pointer" onClick={() => regenerate()} label="Retry">
                        <RefreshCcwIcon className="size-3" />
                      </Action>
                      <Action
                        className="cursor-pointer"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            message.parts
                              .filter((part) => part.type === 'text')
                              .map((part) => part.text)
                              .join('\n'),
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
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {messages.length === 0 && (
          <Suggestions>
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Suggestion
                    key={`placeholder-${index}`}
                    suggestion=""
                    className="animate-pulse pointer-events-none"
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
                  />
                ))}
          </Suggestions>
        )}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea onChange={(e) => setInput(e.target.value)} value={input} />
          <PromptInputToolbar className="p-2">
            <div className="flex items-center gap-2">
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

              {availableConversations.length > 0 && (
                <Select onValueChange={handleLoadConversation}>
                  <SelectTrigger>
                    <History className="size-4" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableConversations.map((conv) => (
                      <SelectItem key={conv.id} value={conv.id} className="relative">
                        <div className="flex items-center justify-between w-full group/item">
                          <div className="flex flex-col items-start min-w-0">
                            <span className="text-sm font-medium truncate max-w-40">
                              {conv.title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {conv.messageCount} messages • {conv.updatedAt.toLocaleDateString()}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="group/button absolute top-1/2 -translate-y-1/2 right-2 opacity-0 button-group group-hover/item:opacity-100 transition-opacity h-6 w-6 p-0 ml-2"
                            onMouseDown={async (e) => {
                              if (
                                await window.confirm(
                                  'Are you sure you want to delete this conversation?',
                                )
                              ) {
                                handleDeleteConversation(e, conv.id);
                              }
                            }}
                            title="Delete Conversation"
                          >
                            <Trash2
                              className="h-3 w-3 text-red-200 group-hover/button:text-red-500 transition-colors"
                              color="currentColor"
                            />
                          </Button>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {isSaving && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Save className="size-3 animate-pulse" />
                  <span>Saving...</span>
                </div>
              )}

              <ModeToggleButton />

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
            </div>
            <PromptInputSubmit disabled={!input} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};
