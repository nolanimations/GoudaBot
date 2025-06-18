import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import "./ChatWindow.css";

function ChatWindow({ messages, streamingMessage, fontClass, isLoading }) {
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, isLoading]);

  return (
    <div className={`chat-window ${fontClass}`}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} sender={msg.sender} text={msg.text} />
      ))}
      {/* Show loading bubble in place of streaming message */}
      {isLoading && !streamingMessage && (
        <div className="loading-dots-bubble">
          <span className="loading-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </div>
      )}
      {/* Streaming message bubble */}
      {streamingMessage && (
        <MessageBubble
          key="streaming-bubble"
          sender={streamingMessage.sender}
          text={streamingMessage.text}
          isStreaming={true}
        />
      )}
      <div ref={chatEndRef} />
    </div>
  );
}

export default ChatWindow;
