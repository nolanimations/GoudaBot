import React, { useRef, useEffect, useState } from "react";
import "./ChatInputArea.css";
import SpeechToTextInput from "./SpeechToTextInput";

function ChatInputArea({
  inputValue,
  onInputChange,
  onSendMessage,
  isLoading,
  useAltFont,
  onToggleFont,
}) {
  const textareaRef = useRef(null);
  const [interimSpeech, setInterimSpeech] = useState("");

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 100;
      textareaRef.current.style.height = `${Math.min(
        scrollHeight,
        maxHeight
      )}px`;
    }
  }, [inputValue, interimSpeech]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
      setInterimSpeech(""); // Reset interim after sending
    }
  };

  return (
    <div className={`input-area ${useAltFont ? "alt-font" : ""}`}>
      <textarea
        ref={textareaRef}
        value={`${inputValue}${interimSpeech ? " " + interimSpeech : ""}`}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Stel een vraag..."
        rows="1"
        disabled={isLoading}
      />
      <button
        onClick={() => {
          onSendMessage();
          setInterimSpeech("");
        }}
        disabled={isLoading || !inputValue.trim()}
        className="send-button"
        aria-label="Verzend bericht"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          width="20"
          height="20"
        >
          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
      </button>
      <button
        onClick={onToggleFont}
        className="font-toggle-button"
        title="Wissel lettertype"
      >
        <span>Aᵃ</span>
      </button>
      <SpeechToTextInput
        isDisabled={isLoading}
        onTranscription={(text) => {
          onInputChange((prev) =>
            (prev + (prev && !prev.endsWith(" ") ? " " : "") + text).trim()
          );
          setInterimSpeech(""); // Clear interim once text is finalized
        }}
        onInterimText={(interim) => {
          setInterimSpeech(interim);
        }}
      />
    </div>
  );
}

export default ChatInputArea;
