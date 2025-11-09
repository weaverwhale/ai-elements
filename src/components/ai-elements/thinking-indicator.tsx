export function ThinkingIndicator() {
  return (
    <div className="py-4">
      <div className="flex items-center gap-2 text-foreground">
        <div className="flex gap-1">
          <span
            className="w-2 h-2 bg-current rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          ></span>
          <span
            className="w-2 h-2 bg-current rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          ></span>
          <span
            className="w-2 h-2 bg-current rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          ></span>
        </div>
      </div>
    </div>
  );
}
