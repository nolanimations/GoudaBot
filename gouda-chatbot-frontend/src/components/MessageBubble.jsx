import React from 'react';
import ReactMarkdown from 'react-markdown'; // Import the component
import remarkGfm from 'remark-gfm'; // Import the GFM plugin
import './MessageBubble.css';

function MessageBubble({ sender, text, isStreaming = false }) {
  // Add the streaming class to the outer container for the cursor effect
  const bubbleClass = `message-bubble ${sender}-message ${isStreaming ? 'streaming' : ''}`;

  // Basic handling for <br> tags potentially sent by backend, convert to newline
  // ReactMarkdown handles standard Markdown newlines correctly.
  const processedText = text.replace(/<br\s*\/?>/gi, '\n');

  return (
    <div className={bubbleClass}>
      {/* Use ReactMarkdown to render the text */}
      <ReactMarkdown
        children={processedText}
        remarkPlugins={[remarkGfm]} // Enable GFM features (tables, strikethrough, etc.)
        components={{
          // Optional: Customize rendering. Example: Make links open in a new tab securely.
          a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />
        }}
      />
      {/* The blinking cursor is now handled purely by CSS on the parent div's ::after pseudo-element */}
    </div>
  );
}

export default MessageBubble;