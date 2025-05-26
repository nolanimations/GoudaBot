import React, { useState, useEffect, useRef } from "react";
import "./SpeechToTextInput";

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
    <div className={`speech-input-container ${isListening ? "listening" : ""}`}>
      <button
        className="mic-button"
        onClick={toggleListening}
        disabled={isDisabled}
        title="Klik om spraak naar tekst te starten of stoppen"
      >
        {isListening ? "Stop" : "Start"} Spraak
      </button>
      {interimText && <div className="interim-text">{interimText}</div>}
    </div>
  );
};

export default SpeechToTextInput;
