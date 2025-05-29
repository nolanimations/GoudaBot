import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatWindow from './components/ChatWindow';
import InstructionsInput from './components/InstructionsInput';
import ChatInputArea from './components/ChatInputArea';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
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

  // 👇 Nieuw: lettertype wissel logica
  const [useAltFont, setUseAltFont] = useState(false);

  const handleToggleFont = () => {
    setUseAltFont(prev => !prev);
  };

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("EventSource explicitly closed.");
    }
  }, []);

  const finalizeStream = useCallback((isError = false, errorMessage = "[Verbinding verbroken]") => {
    if (streamCompletedRef.current) return;

    streamCompletedRef.current = true;
    const finalMessageId = currentStreamIdRef.current;
    const finalMessageText = currentStreamTextRef.current;

    closeEventSource();
    setIsLoading(false);
    setStreamingMessageDisplay({ id: null, text: '', sender: 'bot' });
    currentStreamIdRef.current = null;
    currentStreamTextRef.current = '';

    if (finalMessageId && finalMessageText) {
      const messageToAdd = {
        id: finalMessageId,
        text: isError ? `${finalMessageText} ${errorMessage}` : finalMessageText,
        sender: 'bot'
      };
      setMessages(prev => {
        if (prev.some(msg => msg.id === messageToAdd.id)) return prev;
        return [...prev, messageToAdd];
      });
    }
  }, [closeEventSource]);

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
    setStreamingMessageDisplay({ id: streamingId, text: '', sender: 'bot' });

    try {
      const requestBody = {
        sessionId,
        message: userMessageText,
        customInstructions: customInstructions.trim() || null
      };

      const initiateResponse = await fetch(`${API_BASE_URL}/api/chat/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!initiateResponse.ok) throw new Error(`Server error initiating stream: ${initiateResponse.status}`);
      const { streamId } = await initiateResponse.json();
      if (!streamId) throw new Error("Geen stream ID ontvangen.");

      const streamUrl = `${API_BASE_URL}/api/chat/stream/${streamId}`;
      eventSourceRef.current = new EventSource(streamUrl);

      eventSourceRef.current.onopen = () => console.log("EventSource verbinding geopend.");

      eventSourceRef.current.onmessage = (event) => {
        currentStreamTextRef.current += event.data;
        setStreamingMessageDisplay(prev => ({
          ...prev,
          text: currentStreamTextRef.current
        }));
      };

      eventSourceRef.current.addEventListener('close', (event) => {
        console.log('Stream gesloten door server:', event.data);
        finalizeStream(false);
      });

      eventSourceRef.current.onerror = (err) => {
        console.error("EventSource error:", err);
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          if (!streamCompletedRef.current) finalizeStream(false);
          return;
        }
        setError("Fout bij het ontvangen van het antwoord.");
        finalizeStream(true);
      };

    } catch (err) {
      console.error("Fout in handleSendMessage:", err);
      setError(`Fout: ${err.message || "Kan bericht niet verzenden."}`);
      setIsLoading(false);
      setStreamingMessageDisplay({ id: null, text: '', sender: 'bot' });
      currentStreamIdRef.current = null;
      currentStreamTextRef.current = '';
      closeEventSource();
      streamCompletedRef.current = true;
    }
  }, [currentInput, isLoading, sessionId, customInstructions, closeEventSource, finalizeStream]);

  return (
    <div className="app-container">
      <div className="header-bar">
        <img src="/logo.png" alt="Gouda Logo" className="logo" />
        <span className="header-title">Gouda Chatbot</span>
      </div>

      <h1 style={{ color: 'var(--text-header)' }}>Waar kan ik je mee helpen?</h1>

      <ChatWindow
        messages={messages}
        streamingMessage={streamingMessageDisplay.id ? streamingMessageDisplay : null}
        fontClass={useAltFont ? 'alt-font' : ''}
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
