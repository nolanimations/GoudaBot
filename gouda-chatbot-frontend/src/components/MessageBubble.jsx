import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./MessageBubble.css";

const MessageBubble = React.memo(({ sender, text, isStreaming = false }) => {
  const bubbleClass = `message-bubble ${sender}-message${
    isStreaming ? " streaming" : ""
  }`;
  const processedText = text.replace(/<br\s*\/?>/gi, "\n");

  return (
    <div className={bubbleClass}>
      <ReactMarkdown
        children={processedText}
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      />
    </div>
  );
});

export default MessageBubble;
