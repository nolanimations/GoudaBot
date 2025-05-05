import React from 'react'; // Add React import for React.memo
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MessageBubble.css';

// Wrap the component definition with React.memo
const MessageBubble = React.memo(({ sender, text, isStreaming = false }) => {
  // Add the streaming class to the outer container for the cursor effect
  const bubbleClass = `message-bubble ${sender}-message ${isStreaming ? 'streaming' : ''}`;

  // Basic handling for <br> tags potentially sent by backend, convert to newline
  const processedText = text.replace(/<br\s*\/?>/gi, '\n');

  console.log(`[MessageBubble Render] ID/Key Hint: ${isStreaming ? 'streaming' : 'final'}, Text Length: ${text.length}`); // Add render log

  return (
    <div className={bubbleClass}>
      <ReactMarkdown
        children={processedText}
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />
        }}
      />
      {/* Cursor CSS can be added back here if desired later */}
    </div>
  );
}); // Close React.memo wrapper

export default MessageBubble;