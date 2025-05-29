import React, { useRef, useEffect } from 'react';
import './ChatInputArea.css';

function ChatInputArea({ inputValue, onInputChange, onSendMessage, isLoading, useAltFont, onToggleFont }) {
  const textareaRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 100;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [inputValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className={`input-area ${useAltFont ? 'alt-font' : ''}`}>
      <textarea
        ref={textareaRef}
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Stel een vraag..."
        rows="1"
        disabled={isLoading}
      />
      <button
        onClick={onSendMessage}
        disabled={isLoading || !inputValue.trim()}
        className="send-button"
        aria-label="Verzend bericht"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
      </button>
      <button onClick={onToggleFont} className="font-toggle-button" title="Wissel lettertype">
        <span>Aᵃ</span>
      </button>
      <button
        className="audio-button"
        title="Geluid"
        aria-label="Audio afspelen"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          width="20"
          height="20"
        >
    <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-5 8a7.001 7.001 0 006.938-6H18a5.978 5.978 0 01-2.197 4.65A5.978 5.978 0 0112 19v2h-2v-2a7.001 7.001 0 006.938-6H18a5.978 5.978 0 01-2.197 4.65A5.978 5.978 0 0112 19v2h-2v-2z" />        </svg>
      </button>

    </div>
  );
}

export default ChatInputArea;
