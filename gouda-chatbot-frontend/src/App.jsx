import React, { useState, useEffect, useRef, useCallback } from 'react';
// *** 1. Import throttle ***
import { throttle } from 'lodash.throttle'; // Or from 'lodash' if you installed the full library
import ChatWindow from './components/ChatWindow';
import InstructionsInput from './components/InstructionsInput';
import ChatInputArea from './components/ChatInputArea';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; // Default to empty string
const API_URL = `${API_BASE_URL}/api/chat`;

function App() {
  const [messages, setMessages] = useState([
    { id: 0, text: 'Hallo! Stel je vraag over activiteiten of revalidatie in Gouda.', sender: 'bot' }
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [streamingMessageDisplay, setStreamingMessageDisplay] = useState({ id: null, text: '', sender: 'bot' });
  const currentStreamIdRef = useRef(null);
  const currentStreamTextRef = useRef('');
  const streamCompletedRef = useRef(false);
  const eventSourceRef = useRef(null);

  // *** 2. Create the stable throttled function using useRef ***
  const throttledSetStreamingDisplayText = useRef(
      throttle((newText) => {
          // Update display state with the full accumulated text, but only periodically
          // We still need the ID here to ensure the component renders
          setStreamingMessageDisplay(prev => ({ ...prev, id: currentStreamIdRef.current, text: newText, sender: 'bot' }));
          console.log(`Throttled Update - Text Length: ${newText?.length ?? 0}`);
      }, 150, { leading: true, trailing: true }) // Update immediately, then max every 150ms, ensure last update happens
  ).current; // Use .current to get the stable function reference


  // *** 3. Add useEffect for throttle cleanup ***
  useEffect(() => {
      return () => {
          // Cancel any pending throttled calls when component unmounts
          throttledSetStreamingDisplayText.cancel();
          console.log("Throttled function cancelled on unmount.");
      };
  }, [throttledSetStreamingDisplayText]); // Dependency ensures cleanup is set up correctly


  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("EventSource explicitly closed.");
    }
  }, []);

  // Centralized function to finalize the stream
  const finalizeStream = useCallback((isError = false, errorMessage = "[Verbinding verbroken]") => {
    if (streamCompletedRef.current) {
        console.log("[FINALIZE STREAM] Already marked as completed. Skipping.");
        return;
    }
    streamCompletedRef.current = true;

    // *** 4. Cancel pending throttle calls before final update ***
    throttledSetStreamingDisplayText.cancel();
    console.log("[FINALIZE STREAM] Cancelled pending throttled calls.");

    const finalMessageId = currentStreamIdRef.current;
    const finalMessageText = currentStreamTextRef.current;

    console.log(`[FINALIZE STREAM] START. isError=${isError}. Ref ID: ${finalMessageId}, Ref Text: "${finalMessageText}"`);

    closeEventSource();
    setIsLoading(false);

    // Reset display state and refs
    setStreamingMessageDisplay({ id: null, text: '', sender: 'bot' });
    currentStreamIdRef.current = null;
    currentStreamTextRef.current = '';

    if (finalMessageId && finalMessageText) {
        const messageToAdd = {
            id: finalMessageId,
            text: isError ? `${finalMessageText} ${errorMessage}` : finalMessageText,
            sender: 'bot'
        };
        console.log(`[FINALIZE STREAM] Preparing to add message to state:`, messageToAdd);
        setMessages(prev => {
             console.log(`[FINALIZE STREAM] setMessages update function. Adding ID ${messageToAdd.id}. Prev count: ${prev.length}`);
             if (prev.some(msg => msg.id === messageToAdd.id)) {
                 console.warn(`[FINALIZE STREAM] Message with ID ${messageToAdd.id} already exists. Skipping add.`);
                 return prev;
             }
             return [...prev, messageToAdd];
        });
    } else {
         console.log(`[FINALIZE STREAM] No final message text or ID to add (ID: ${finalMessageId}, Text: "${finalMessageText}").`);
    }
    console.log(`[FINALIZE STREAM] END.`);

  }, [closeEventSource, setIsLoading, setMessages, setStreamingMessageDisplay, throttledSetStreamingDisplayText]); // Include dependencies (setters, throttle func)


  useEffect(() => {
    return () => {
        streamCompletedRef.current = false;
        closeEventSource();
    };
  }, [closeEventSource]);


  const handleSendMessage = useCallback(async () => {
    const userMessageText = currentInput.trim();
    if (!userMessageText || isLoading) return;

    setError(null);
    closeEventSource();
    streamCompletedRef.current = false;
    currentStreamTextRef.current = '';

    const newUserMessage = { id: Date.now(), text: userMessageText, sender: 'user' };
    setMessages(prev => [...prev, newUserMessage]);
    setCurrentInput('');
    setIsLoading(true);

    const streamingId = Date.now() + 1;
    currentStreamIdRef.current = streamingId;
    setStreamingMessageDisplay({ id: streamingId, text: '', sender: 'bot' }); // Set initial display state

    try {
      const requestBody = { sessionId, message: userMessageText, customInstructions: customInstructions.trim() || null };
      const initiateResponse = await fetch(`${API_URL}/initiate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
      if (!initiateResponse.ok) {
          let errorText = `Server error initiating stream: ${initiateResponse.status}`;
           try { const errorData = await initiateResponse.json(); errorText = errorData.detail || errorData.title || JSON.stringify(errorData); } catch { /* Ignore */ }
          throw new Error(errorText);
      }
      const { streamId } = await initiateResponse.json();
      if (!streamId) throw new Error("Did not receive a valid stream ID.");

      const streamUrl = `${API_URL}/stream/${streamId}`;
      eventSourceRef.current = new EventSource(streamUrl);

      eventSourceRef.current.onopen = () => console.log("EventSource connection established.");

      eventSourceRef.current.onmessage = (event) => {
          const newData = event.data;
          console.log("SSE onmessage received data:", newData);

          // Append to the ref immediately to track full text
          currentStreamTextRef.current += newData;

          // *** 5. Call the throttled function to update display state ***
          // Pass the *full* accumulated text from the ref
          throttledSetStreamingDisplayText(currentStreamTextRef.current);
      };

      eventSourceRef.current.addEventListener('close', (event) => {
          console.log('Stream closed by server event:', event.data);
          finalizeStream(false);
      });

      eventSourceRef.current.onerror = (err) => {
          console.error("EventSource encountered an error object:", err);
          if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.CLOSED) {
             console.log("EventSource error occurred but state is CLOSED.");
             if (!streamCompletedRef.current) { finalizeStream(false); }
             return;
          }
          setError("Fout bij het ontvangen van het antwoord.");
          finalizeStream(true);
      };

    } catch (err) {
        console.error("Error in handleSendMessage:", err);
        setError(`Fout: ${err.message || "Kan bericht niet verzenden."}`);
        setIsLoading(false);
        setStreamingMessageDisplay({ id: null, text: '', sender: 'bot' });
        currentStreamIdRef.current = null;
        currentStreamTextRef.current = '';
        closeEventSource();
        streamCompletedRef.current = true;
    }
  // Include throttle function ref in dependencies if needed by linters, though its reference is stable
  }, [currentInput, isLoading, sessionId, customInstructions, closeEventSource, finalizeStream, throttledSetStreamingDisplayText]);


  return (
    <div className="app-container">
      <h1>Waar kan ik je mee helpen?</h1>
      <InstructionsInput
        value={customInstructions}
        onChange={setCustomInstructions}
        disabled={isLoading}
      />
      <ChatWindow
        messages={messages}
        streamingMessage={streamingMessageDisplay.id ? streamingMessageDisplay : null}
      />
       {error && <div className="error-message">{error}</div>}
      <ChatInputArea
        inputValue={currentInput}
        onInputChange={setCurrentInput}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </div>
  );
}

export default App;