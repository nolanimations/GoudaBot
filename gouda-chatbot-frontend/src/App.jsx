import { useState, useEffect, useRef, useCallback } from "react";
import ChatWindow from "./components/ChatWindow";
import ChatInputArea from "./components/ChatInputArea";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_URL = `${API_BASE_URL}/api/chat`;

function App() {
  const [messages, setMessages] = useState([
    {
      id: 0,
      text: "Hallo! Stel je vraag over activiteiten in Gouda.",
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

  // 👇 Nieuw: lettertype wissel logica
  const [useAltFont, setUseAltFont] = useState(false);

  const handleToggleFont = () => {
    setUseAltFont((prev) => !prev);
  };

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("EventSource explicitly closed.");
    }
  }, []);

  const finalizeStream = useCallback(
    (isError = false, errorMessage = "[Verbinding verbroken]") => {
      if (streamCompletedRef.current) return;

      streamCompletedRef.current = true;
      const finalMessageId = currentStreamIdRef.current;
      const finalMessageText = currentStreamTextRef.current;

      console.log(
        `Finalizing stream. Error: ${isError}, Message ID: ${finalMessageId}`
      );

      closeEventSource();
      setIsLoading(false);
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
          if (prev.some((msg) => msg.id === messageToAdd.id)) return prev;
          return [...prev, messageToAdd];
        });
      }
    },
    [closeEventSource]
  );

  useEffect(() => {
    return () => {
      console.log("Cleaning up on component unmount.");
      streamCompletedRef.current = false;
      closeEventSource();
    };
  }, [closeEventSource]);

  const handleSendMessage = useCallback(async () => {
    const userMessageText = currentInput.trim();
    if (!userMessageText || isLoading) return;

    console.log(`handleSendMessage called with input: "${userMessageText}"`);

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

    try {
      const requestBody = {
        sessionId,
        message: userMessageText,
        customInstructions: customInstructions.trim() || null,
      };
      console.log(
        `Sending POST to ${API_URL}/initiate with body:`,
        requestBody
      );

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

      console.log(`Received stream ID: ${streamId}`);

      if (!streamId) throw new Error("Did not receive a valid stream ID.");

      const streamUrl = `${API_BASE_URL}/api/chat/stream/${streamId}`;
      console.log(`Connecting to stream URL: ${streamUrl}`);
      const response = await fetch(streamUrl);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      currentStreamTextRef.current = "";
      setStreamingMessageDisplay({ id: streamingId, text: "", sender: "bot" });

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          console.log(`Received chunk from stream: ${chunk}`);
          currentStreamTextRef.current += chunk;
          setStreamingMessageDisplay((prev) => ({
            ...prev,
            text: currentStreamTextRef.current,
          }));
        }
      }
      console.log(
        `Stream finished. Final text: "${currentStreamTextRef.current}"`
      );
      finalizeStream(false);
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
  ]);

  return (
    <div className="app-container">
      <div className="header-bar">
        <img src="/logo.png" alt="Gouda Logo" className="logo" />
        <span className={`header-title ${useAltFont ? "alt-font" : ""}`}>
          Gouda Chatbot
        </span>
      </div>

      <ChatWindow
        messages={messages}
        streamingMessage={
          streamingMessageDisplay.id ? streamingMessageDisplay : null
        }
        fontClass={useAltFont ? "alt-font" : ""}
        isLoading={isLoading}
      />

      {error && <div className="error-message">{error}</div>}

      <ChatInputArea
        inputValue={currentInput}
        onInputChange={setCurrentInput}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        useAltFont={useAltFont}
        onToggleFont={handleToggleFont}
      />
    </div>
  );
}

export default App;
