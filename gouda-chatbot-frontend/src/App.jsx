import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatWindow from "./components/ChatWindow";
import InstructionsInput from "./components/InstructionsInput";
import ChatInputArea from "./components/ChatInputArea";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""; // Default to empty string
const API_URL = `${API_BASE_URL}/api/chat`;

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

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("EventSource explicitly closed.");
    }
  }, []);

  // Centralized function to finalize the stream
  const finalizeStream = useCallback(
    (isError = false, errorMessage = "[Verbinding verbroken]") => {
      if (streamCompletedRef.current) {
        console.log("[FINALIZE STREAM] Already marked as completed. Skipping.");
        return;
      }
      streamCompletedRef.current = true;

      const finalMessageId = currentStreamIdRef.current;
      const finalMessageText = currentStreamTextRef.current;

      closeEventSource();
      setIsLoading(false);

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

      // Delay clearing the streaming bubble until after the message is added
      setTimeout(() => {
        setStreamingMessageDisplay({ id: null, text: "", sender: "bot" });
        currentStreamIdRef.current = null;
        currentStreamTextRef.current = "";
      }, 50); // Small delay to allow React to render the last streaming update
    },
    [closeEventSource, setIsLoading, setMessages]
  ); // Remove throttle func from dependencies

  useEffect(() => {
    return () => {
      streamCompletedRef.current = false;
      closeEventSource();
    };
  }, [closeEventSource, streamingMessageDisplay]);

  const handleSendMessage = useCallback(async () => {
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
    setStreamingMessageDisplay({ id: streamingId, text: "", sender: "bot" }); // Set initial display state

    try {
      const requestBody = {
        sessionId,
        message: userMessageText,
        customInstructions: customInstructions.trim() || null,
      };
      const initiateResponse = await fetch(`${API_URL}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!initiateResponse.ok) {
        let errorText = `Server error initiating stream: ${initiateResponse.status}`;
        try {
          const errorData = await initiateResponse.json();
          errorText =
            errorData.detail || errorData.title || JSON.stringify(errorData);
        } catch {
          /* Ignore */
        }
        throw new Error(errorText);
      }
      const { streamId } = await initiateResponse.json();
      if (!streamId) throw new Error("Did not receive a valid stream ID.");

      const streamUrl = `${API_URL}/stream/${streamId}`;
      eventSourceRef.current = new EventSource(streamUrl);

      eventSourceRef.current.onopen = () =>
        console.log("EventSource connection established.");

      eventSourceRef.current.onmessage = (event) => {
        const newData = event.data;
        console.log("SSE onmessage received data:", newData);

        // Append only the new chunk to the display
        setStreamingMessageDisplay((prev) => ({
          ...prev,
          id: currentStreamIdRef.current,
          text: prev.text + newData,
          sender: "bot",
        }));

        // Append to the ref immediately to track full text
        currentStreamTextRef.current += newData;
      };

      eventSourceRef.current.addEventListener("close", (event) => {
        console.log("Stream closed by server event:", event.data);
        finalizeStream(false);
      });

      eventSourceRef.current.onerror = (err) => {
        console.error("EventSource encountered an error object:", err);
        if (
          eventSourceRef.current &&
          eventSourceRef.current.readyState === EventSource.CLOSED
        ) {
          console.log("EventSource error occurred but state is CLOSED.");
          if (!streamCompletedRef.current) {
            finalizeStream(false);
          }
          return;
        }
        setError("Fout bij het ontvangen van het antwoord.");
        finalizeStream(true);
      };
    } catch (err) {
      console.error("Error in handleSendMessage:", err);
      setError(`Fout: ${err.message || "Kan bericht niet verzenden."}`);
      setIsLoading(false);
      setStreamingMessageDisplay({ id: null, text: "", sender: "bot" });
      currentStreamIdRef.current = null;
      currentStreamTextRef.current = "";
      closeEventSource();
      streamCompletedRef.current = true;
    }
  }, [
    currentInput,
    isLoading,
    sessionId,
    customInstructions,
    closeEventSource,
    finalizeStream,
  ]); // Remove throttle func from dependencies

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
