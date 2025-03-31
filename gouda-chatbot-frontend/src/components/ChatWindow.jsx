import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import './ChatWindow.css';

// Display messages + the currently streaming message
function ChatWindow({ messages, streamingMessage }) {
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Alternative: Instant scroll
    // if (chatEndRef.current) {
    //    chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
    // }
  };

  // Scroll whenever messages or the streaming message changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);
    console.log(`[ChatWindow Render] Count=${messages.length}, Streaming=${!!streamingMessage}, LastMsgID=${messages[messages.length - 1]?.id}, StreamingID=${streamingMessage?.id}`);

  return (
    <div className="chat-window">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} sender={msg.sender} text={msg.text} />
      ))}
      {/* Render the streaming message with blinking cursor */}
      {streamingMessage && (
        <MessageBubble
          key={streamingMessage.id}
          sender={streamingMessage.sender}
          text={streamingMessage.text}
          isStreaming={true} // Add prop to enable cursor
        />
      )}
      {/* Empty div to mark the end for scrolling */}
      <div ref={chatEndRef} />
    </div>
  );
}

export default ChatWindow;