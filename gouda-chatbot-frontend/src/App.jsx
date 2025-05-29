import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatWindow from "./components/ChatWindow";
import InstructionsInput from "./components/InstructionsInput";
import ChatInputArea from "./components/ChatInputArea";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
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

  // State to hold the streaming message object for *rendering*
  const [streamingMessageDisplay, setStreamingMessageDisplay] = useState({
    id: null,
    text: "",
    sender: "bot",
  });

  // Refs to hold the *latest* values reliably for use in callbacks
  const currentStreamIdRef = useRef(null); // *** ADD REF FOR ID ***
  const currentStreamTextRef = useRef(""); // Changed name for clarity
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

      // *** READ FROM REFS ***
      const finalMessageId = currentStreamIdRef.current;
      const finalMessageText = currentStreamTextRef.current;

      console.log(
        `[FINALIZE STREAM] START. isError=${isError}. Ref ID: ${finalMessageId}, Ref Text: "${finalMessageText}"`
      );

      closeEventSource();
      setIsLoading(false);

      // Reset display state and refs
      setStreamingMessageDisplay({ id: null, text: "", sender: "bot" });
      currentStreamIdRef.current = null;
      currentStreamTextRef.current = "";

      // Add the final message using values read from refs
      if (finalMessageId && finalMessageText) {
        const messageToAdd = {
          id: finalMessageId,
          text: isError
            ? `${finalMessageText} ${errorMessage}`
            : finalMessageText,
          sender: "bot",
        };
        console.log(
          `[FINALIZE STREAM] Preparing to add message to state:`,
          messageToAdd
        );
        setMessages((prev) => {
          console.log(
            `[FINALIZE STREAM] setMessages update function. Adding ID ${messageToAdd.id}. Prev count: ${prev.length}`
          );
          if (prev.some((msg) => msg.id === messageToAdd.id)) {
            console.warn(
              `[FINALIZE STREAM] Message with ID ${messageToAdd.id} already exists. Skipping add.`
            );
            return prev;
          }
          return [...prev, messageToAdd];
        });
      } else {
        console.log(
          `[FINALIZE STREAM] No final message text or ID to add (ID: ${finalMessageId}, Text: "${finalMessageText}").`
        );
      }
      console.log(`[FINALIZE STREAM] END.`);

      // Keep dependencies minimal for the callback itself
    },
    [closeEventSource, setMessages, setIsLoading, setStreamingMessageDisplay]
  ); // Added setters

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
    currentStreamTextRef.current = ""; // Reset text ref

    const newUserMessage = {
      id: Date.now(),
      text: userMessageText,
      sender: "user",
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setCurrentInput("");
    setIsLoading(true);

    // Generate and STORE the ID in the REF immediately
    const streamingId = Date.now() + 1;
    currentStreamIdRef.current = streamingId; // *** STORE ID IN REF ***

    // Update display state for rendering
    setStreamingMessageDisplay({ id: streamingId, text: "", sender: "bot" });

    try {
      // ... (fetch initiate, get streamId) ...
      const requestBody = {
        sessionId,
        message: userMessageText,
        customInstructions: customInstructions.trim() || null,
      };
      const initiateResponse = await fetch(
        `${API_BASE_URL}/api/chat/initiate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );
      if (!initiateResponse.ok)
        throw new Error(
          `Server error initiating stream: ${initiateResponse.status}`
        );
      const { streamId } = await initiateResponse.json();
      if (!streamId) throw new Error("Did not receive a valid stream ID.");

      const streamUrl = `${API_BASE_URL}/api/chat/stream/${streamId}`;
      eventSourceRef.current = new EventSource(streamUrl);

      eventSourceRef.current.onopen = () =>
        console.log("EventSource connection established.");

      eventSourceRef.current.onmessage = (event) => {
        // Update the text ref directly
        currentStreamTextRef.current += event.data;
        // Update the display state for rendering
        setStreamingMessageDisplay((prev) => ({
          ...prev,
          text: currentStreamTextRef.current,
        }));
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
      setStreamingMessageDisplay({ id: null, text: "", sender: "bot" }); // Reset display
      currentStreamIdRef.current = null; // Reset refs on fetch error
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
        // Pass the display state object
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
