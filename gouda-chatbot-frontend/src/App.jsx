import React, { useState, useEffect, useRef, useCallback } from "react";
// *** 1. Import throttle ***
import throttle from "lodash/throttle";
import ChatWindow from "./components/ChatWindow";
import InstructionsInput from "./components/InstructionsInput";
import ChatInputArea from "./components/ChatInputArea";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""; // Default to empty string
const API_URL = `${API_BASE_URL}/api/chat`;

// Utility sleep function
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function App() {
  const [messages, setMessages] = useState([
    {
      id: 0,
      text: "Hallo! Stel je vraag over activiteiten of revalidatie in Gouda.",
      sender: "bot",
    },
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [streamingMessageDisplay, setStreamingMessageDisplay] = useState({
    id: null,
    text: "",
    sender: "bot",
  });
  const currentStreamIdRef = useRef(null);
  const currentStreamTextRef = useRef("");
  const streamCompletedRef = useRef(false);
  const eventSourceRef = useRef(null);

  // *** 2. Create the stable throttled function using useRef ***
  const throttledSetStreamingDisplayText = useRef(
    throttle(
      (newText) => {
        setStreamingMessageDisplay((prev) => {
          const newState = {
            ...prev,
            id: currentStreamIdRef.current,
            text: newText,
            sender: "bot",
          };
          return newState;
        });
      },
      30, // Lower delay for more frequent updates
      { leading: true, trailing: true }
    )
  ).current;

  // Added this useEffect to log the state *after* React processes the update
  useEffect(() => {
    if (streamingMessageDisplay.id) {
      // Optional: console.log for debugging
    }
  }, [streamingMessageDisplay]); // Run whenever the display state changes

  // *** 3. Add useEffect for throttle cleanup ***
  useEffect(() => {
    return () => {
      // Cancel any pending throttled calls when component unmounts
      throttledSetStreamingDisplayText.cancel();
    };
  }, [throttledSetStreamingDisplayText]); // Dependency ensures cleanup is set up correctly

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Centralized function to finalize the stream
  const finalizeStream = useCallback(
    (isError = false, errorMessage = "[Verbinding verbroken]") => {
      if (streamCompletedRef.current) {
        return;
      }
      streamCompletedRef.current = true;

      // *** 4. Cancel pending throttle calls before final update ***
      throttledSetStreamingDisplayText.cancel();

      const finalMessageId = currentStreamIdRef.current;
      const finalMessageText = currentStreamTextRef.current;

      closeEventSource();
      setIsLoading(false);

      // Reset display state and refs
      setStreamingMessageDisplay({ id: null, text: "", sender: "bot" });
      currentStreamIdRef.current = null;
      currentStreamTextRef.current = "";

      if (finalMessageId && finalMessageText) {
        const messageToAdd = {
          id: finalMessageId,
          text: isError
            ? `${finalMessageText} ${errorMessage}`
            : finalMessageText,
          sender: "bot",
        };
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === messageToAdd.id)) {
            return prev;
          }
          return [...prev, messageToAdd];
        });
      }
    },
    [
      closeEventSource,
      setIsLoading,
      setMessages,
      setStreamingMessageDisplay,
      throttledSetStreamingDisplayText,
    ]
  ); // Include dependencies (setters, throttle func)

  useEffect(() => {
    return () => {
      streamCompletedRef.current = false;
      closeEventSource();
    };
  }, [closeEventSource]);

  const handleSendMessage = useCallback(() => {
    const userMessageText = currentInput.trim();
    if (!userMessageText || isLoading) return;

    setError(null);
    closeEventSource();
    streamCompletedRef.current = false;
    currentStreamTextRef.current = "";

    const newUserMessage = {
      id: Date.now(),
      text: userMessageText,
      sender: "user",
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setCurrentInput("");
    setIsLoading(true);

    const streamingId = Date.now() + 1;
    currentStreamIdRef.current = streamingId;
    setStreamingMessageDisplay({ id: streamingId, text: "", sender: "bot" });

    // --- SSE connection ---
    const eventSource = new EventSource(
      `${API_URL}?session_id=${sessionId}&instructions=${encodeURIComponent(
        customInstructions
      )}&message=${encodeURIComponent(userMessageText)}`
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const newData = event.data;
      currentStreamTextRef.current += newData;
      setStreamingMessageDisplay({
        id: currentStreamIdRef.current,
        text: currentStreamTextRef.current,
        sender: "bot",
      });
    };

    eventSource.onerror = () => {
      finalizeStream(true, "[Verbinding verbroken]");
    };

    eventSource.onopen = () => {
      // Connection established
    };

    eventSource.addEventListener("end", () => {
      finalizeStream(false);
    });
  }, [
    currentInput,
    isLoading,
    closeEventSource,
    finalizeStream,
    sessionId,
    customInstructions,
  ]);

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
        streamingMessage={
          streamingMessageDisplay.id ? streamingMessageDisplay : null
        }
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
