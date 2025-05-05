import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import './ChatWindow.css';

function ChatWindow({ messages, streamingMessage }) {
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // console.log(`[ChatWindow Render] Count=${messages.length}, Streaming=${!!streamingMessage}, LastMsgID=${messages[messages.length - 1]?.id}, StreamingID=${streamingMessage?.id}`);

  return (
    <div className="chat-window">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} sender={msg.sender} text={msg.text} />
      ))}
      {/* Render the streaming message with blinking cursor */}
      {streamingMessage && (
        <MessageBubble
          key="streaming-bubble" // <-- CHANGE THIS TO A FIXED STRING KEY
          sender={streamingMessage.sender}
          text={streamingMessage.text}
          isStreaming={true}
        />
      )}
      {/* Empty div to mark the end for scrolling */}
      <div ref={chatEndRef} />
    </div>
  );
}

export default ChatWindow;