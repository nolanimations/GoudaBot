import React from "react";
import "./InstructionsInput.css";

function InstructionsInput({ value, onChange, disabled }) {
  return (
    <div className="instructions-container">
      <label htmlFor="custom-instructions">
        Custom Instructies (optioneel):
      </label>
      <textarea
        id="custom-instructions"
        rows="2" // Start smaller
        placeholder="Bijv: Focus alleen op sportactiviteiten voor senioren."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

export default InstructionsInput;
