import { useState, useEffect, useRef } from "react";
import "./SpeechToTextInput.css";

const SpeechToTextInput = ({
  onTranscription,
  onInterimText,
  isDisabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const manuallyStoppedRef = useRef(false);
  const silenceTimerRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "nl-NL";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      clearTimeout(silenceTimerRef.current);
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (interim && onInterimText) {
        onInterimText(interim.trim());
      }

      if (final) {
        console.log("transcription:", final.trim());
        if (onTranscription) onTranscription(final.trim());
        if (onInterimText) onInterimText(""); // Clear interim after commit

        // Wait 3 seconds before stopping if no more input
        silenceTimerRef.current = setTimeout(() => {
          console.log("Stopping recognition due to silence");
          stopRecognition();
        }, 3000); // 3 seconds to allow for quick follow-up speech
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      stopRecognition();
    };

    recognition.onend = () => {
      if (!manuallyStoppedRef.current) {
        recognition.start(); // auto-restart if not manually stopped
      } else {
        setIsListening(false);
        console.log("Recognition stopped manually.");
      }
    };

    recognitionRef.current = recognition;
  }, [onTranscription, onInterimText]);

  const stopRecognition = () => {
    manuallyStoppedRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
    clearTimeout(silenceTimerRef.current);
    if (onInterimText) onInterimText(""); // Clear display
  };

  const toggleListening = () => {
    if (isDisabled) return;

    if (isListening) {
      console.log("Mic button clicked, stopping speech recognition.");
      stopRecognition();
    } else {
      console.log("Mic button clicked, starting speech recognition.");
      manuallyStoppedRef.current = false;
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  return (
    <button
      className={`mic-button ${isListening ? "listening" : ""}`}
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
