import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

export default function FormStepper({ steps, currentStep, onStepChange }) {
  const stepNavRef = useRef(null);

  useEffect(() => {
    if (stepNavRef.current) {
      const activeEl = stepNavRef.current.querySelector(`.intake-step-chip[data-step="${currentStep}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentStep]);

  const activeStepObj = steps.find(s => s.n === currentStep) || steps[0];
  const percent = Math.round((currentStep / steps.length) * 100);

  return (
    <div className="intake-stepper-container">
      {/* Top Header: Step Counter & Active Title */}
      <div className="intake-stepper-header">
        <div className="intake-stepper-badge-group">
          <span className="intake-step-num-pill">Step {currentStep} of {steps.length}</span>
          <span className="intake-step-title-active">{activeStepObj.label}</span>
          {activeStepObj.de && (
            <span className="intake-step-de-sub">[{activeStepObj.de}]</span>
          )}
        </div>
        <span className="intake-step-progress-percent">{percent}%</span>
      </div>

      {/* Visual Segmented Progress Bar */}
      <div className="intake-stepper-track" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={steps.length}>
        {steps.map((s) => (
          <button
            key={s.n}
            type="button"
            className={`intake-stepper-segment ${s.n < currentStep ? 'completed' : s.n === currentStep ? 'active' : ''}`}
            onClick={() => onStepChange(s.n)}
            title={`Step ${s.n}: ${s.label}`}
            aria-label={`Jump to Step ${s.n}: ${s.label}`}
          />
        ))}
      </div>

      {/* Interactive Step Chips */}
      <div className="intake-step-chips-scroll" ref={stepNavRef}>
        {steps.map((s) => {
          const isCompleted = s.n < currentStep;
          const isActive = s.n === currentStep;
          return (
            <button
              key={s.n}
              type="button"
              data-step={s.n}
              onClick={() => onStepChange(s.n)}
              className={`intake-step-chip ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <span className="intake-step-chip-badge">
                {isCompleted ? <Check size={11} strokeWidth={3} /> : s.n}
              </span>
              <span className="intake-step-chip-label">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
