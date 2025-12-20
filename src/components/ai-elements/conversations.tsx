import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '@/types/chatTypes';

interface SearchableConversationDropdownProps {
  conversations: ConversationSummary[];
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (e: React.MouseEvent, conversationId: string) => void;
  isLoading?: boolean;
  isSaving?: boolean;
}

export const SearchableConversationDropdown: React.FC<
  SearchableConversationDropdownProps
> = ({
  conversations,
  onSelectConversation,
  onDeleteConversation,
  isLoading = false,
  isSaving = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    showAbove: false,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate dropdown position based on trigger button
  const calculatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = dropdownRef.current?.offsetWidth || 320;
    const viewportWidth = window.innerWidth;
    const margin = 16;

    let left = rect.left;

    left = Math.max(margin, left);
    left = Math.min(left, viewportWidth - dropdownWidth - margin);

    const spaceAbove = rect.top;
    const minDropdownHeight = 200;

    let top: number;
    let showAbove: boolean;

    if (spaceAbove >= minDropdownHeight) {
      top = rect.top - 8;
      showAbove = true;
    } else {
      top = rect.bottom + 8;
      showAbove = false;
    }

    setDropdownPosition({ top, left, showAbove });
    setIsPositioned(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
        setIsPositioned(false);
        setSearchQuery('');
      }
    };

    const handleResize = () => {
      if (isOpen) {
        calculatePosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens and calculate position
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      setTimeout(() => {
        calculatePosition();
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      // Calculate position immediately before opening
      calculatePosition();
      setSearchQuery('');
    } else {
      // Reset positioning state when closing
      setIsPositioned(false);
    }
    setIsOpen(!isOpen);
  };

  const handleSelectConversation = (conversationId: string) => {
    onSelectConversation(conversationId);
    setIsOpen(false);
    setIsPositioned(false);
    setSearchQuery('');
  };

  const handleDeleteConversation = async (
    e: React.MouseEvent,
    conversationId: string
  ) => {
    e.stopPropagation();
    if (
      await window.confirm('Are you sure you want to delete this conversation?')
    ) {
      onDeleteConversation(e, conversationId);
    }
  };

  if (conversations.length === 0) {
    return null;
  }

  const dropdownContent =
    isOpen && isPositioned ? (
      <div
        ref={dropdownRef}
        className={`fixed z-[100] w-[20rem] max-w-[calc(100vw-32px)] bg-popover text-popover-foreground border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 duration-200 ${
          dropdownPosition.showAbove
            ? 'origin-bottom slide-in-from-bottom-2'
            : 'origin-top slide-in-from-top-2'
        }`}
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          transform: dropdownPosition.showAbove
            ? 'translateY(-100%)'
            : 'translateY(0)',
        }}
      >
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={`Search ${conversations.length} conversations...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {searchQuery
                ? 'No conversations match your search'
                : 'No conversations found'}
            </div>
          ) : (
            <div className="p-2">
              {filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className="relative flex items-start justify-between w-full group/item p-3 rounded-md hover:bg-accent cursor-pointer text-left transition-colors"
                >
                  <div className="flex flex-col items-start min-w-0 flex-1 pr-10 space-y-1">
                    <span className="text-sm font-medium truncate max-w-full leading-tight">
                      {conv.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {conv.messageCount} messages •{' '}
                      {conv.updatedAt.toLocaleDateString()}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity h-7 w-7 p-0 shrink-0 z-10  text-muted-foreground hover:text-red-500 transition-colors"
                    onMouseDown={e => handleDeleteConversation(e, conv.id)}
                    title="Delete Conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      <Button
        ref={triggerRef}
        onClick={handleToggle}
        variant="outline"
        size="icon"
        className="cursor-pointer"
        title="Conversation History"
      >
        <History
          className={cn('size-4', (isLoading || isSaving) && 'animate-pulse')}
        />
      </Button>
      {typeof document !== 'undefined' &&
        createPortal(dropdownContent, document.body)}
    </>
  );
};
