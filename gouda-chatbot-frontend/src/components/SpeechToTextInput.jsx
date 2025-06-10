import React, { useState, useEffect, useRef } from "react";
import "./SpeechToTextInput.css";

const SpeechToTextInput = ({ onTranscription, isDisabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "nl-NL"; // or 'en-US', 'it-IT', etc.
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      if (event.results[0].isFinal) {
        onTranscription(transcript.trim());
        setIsListening(false);
        setInterimText("");
      } else {
        setInterimText(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [onTranscription]);

  const toggleListening = () => {
    if (isDisabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setInterimText("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  return (
    <button
      className="audio-button"
      onClick={toggleListening}
      disabled={isDisabled}
      title="Klik om spraak naar tekst te starten of stoppen"
      aria-label="Spraak invoer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        width="20"
        height="20"
      >
        <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-5 8a7.001 7.001 0 006.938-6H18a5.978 5.978 0 01-2.197 4.65A5.978 5.978 0 0112 19v2h-2v-2a7.001 7.001 0 006.938-6H18a5.978 5.978 0 01-2.197 4.65A5.978 5.978 0 0112 19v2h-2v-2z" />
      </svg>
    </button>
  );
};

export default SpeechToTextInput;
