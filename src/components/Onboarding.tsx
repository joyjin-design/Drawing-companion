import { useState } from "react";

const ONBOARDING_STORAGE_KEY = "drawing-companion-onboarding-done";

export function setOnboardingDone(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
  }
}

export function hasSeenOnboarding(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
}

export type OnboardingProps = {
  onFinish: () => void;
  onLogIn: () => void;
  onFinishAndStartCamera?: () => void;
};

export default function Onboarding({ onFinish, onLogIn, onFinishAndStartCamera }: OnboardingProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  const handleSkip = () => {
    setOnboardingDone();
    onFinish();
  };

  const handleBack = () => {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleLogIn = () => {
    setOnboardingDone();
    onLogIn();
  };

  const handleGetStartedWelcome = () => setStep(1);
  const handleNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
  };
  const handleGetStartedFinal = () => {
    setOnboardingDone();
    if (onFinishAndStartCamera) {
      onFinishAndStartCamera();
    } else {
      onFinish();
    }
  };

  return (
    <div className="onboarding">
      {step === 0 ? (
        /* Welcome screen */
        <div className="onboarding-screen onboarding-welcome">
          <header className="onboarding-header onboarding-header-welcome">
            <span />
            <button
              type="button"
              className="onboarding-link"
              onClick={handleLogIn}
            >
              Sign up
            </button>
          </header>
          <div className="onboarding-welcome-graphic">
            <div className="onboarding-welcome-circle">
              <div className="onboarding-welcome-camera-ring">
                <svg
                  className="onboarding-welcome-camera-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <img
                src="/onboarding/welcome-apple.png"
                alt=""
                className="onboarding-welcome-thumb onboarding-welcome-thumb-ref"
              />
              <img
                src="/onboarding/welcome-sketch.png"
                alt=""
                className="onboarding-welcome-thumb onboarding-welcome-thumb-draw"
              />
            </div>
          </div>
          <div className="onboarding-pill">DRAWING COMPANION</div>
          <h1 className="onboarding-title onboarding-title-welcome">
            <span className="onboarding-title-highlight">Easely</span> draw from
            real life
          </h1>
          <p className="onboarding-desc">
            Capture real objects with your camera and practice drawing them at
            your own pace.
          </p>
          <div className="onboarding-actions">
            <button
              type="button"
              className="onboarding-btn-primary"
              onClick={handleGetStartedWelcome}
            >
              Get started →
            </button>
            <button
              type="button"
              className="onboarding-skip"
              onClick={handleSkip}
            >
              Skip for now
            </button>
          </div>
        </div>
      ) : (
        /* Steps 1–3 */
        <div className="onboarding-screen onboarding-steps">
          <header className="onboarding-header onboarding-header-steps">
            <button
              type="button"
              className="onboarding-close"
              onClick={handleBack}
              aria-label="Previous step"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <title>arrow.left</title>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="onboarding-step-label">
              Step {step} of 3
            </span>
            <span />
          </header>
          <div className="onboarding-progress">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`onboarding-progress-dot ${
                  i <= step ? "onboarding-progress-dot-active" : ""
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <>
              <h2 className="onboarding-step-title">
                Capture your inspiration
              </h2>
              <p className="onboarding-step-desc">
                Point your camera at anything that inspires you to start your
                creative journey.
              </p>
              <div className="onboarding-frame onboarding-frame-camera">
                <img
                  src="/onboarding/step1-daisy.svg"
                  alt="Daisy in vase"
                  className="onboarding-frame-img"
                />
                <div className="onboarding-frame-brackets" aria-hidden />
                <div className="onboarding-frame-shutter" aria-hidden />
              </div>
              <div className="onboarding-actions">
                <button
                  type="button"
                  className="onboarding-btn-primary"
                  onClick={handleNext}
                >
                  Next →
                </button>
                <button
                  type="button"
                  className="onboarding-skip"
                  onClick={handleSkip}
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="onboarding-step-title">Bring it to life</h2>
              <p className="onboarding-step-desc">
                Use your photo as a blueprint. Sketch, and color to transform
                your vision into a masterpiece.
              </p>
              <div className="onboarding-frame">
                <img
                  src="/onboarding/step2-drawing.svg"
                  alt="Hand drawing"
                  className="onboarding-frame-img"
                />
              </div>
              <div className="onboarding-actions">
                <button
                  type="button"
                  className="onboarding-btn-primary"
                  onClick={handleNext}
                >
                  Next →
                </button>
                <button
                  type="button"
                  className="onboarding-skip"
                  onClick={handleSkip}
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="onboarding-step-title">Compare the details</h2>
              <p className="onboarding-step-desc">
                Overlay your drawing on the original photo and use the slider to
                check for accuracy.
              </p>
              <div className="onboarding-compare">
                <div className="onboarding-compare-panel">
                  <span className="onboarding-compare-tag">REFERENCE</span>
                  <img
                    src="/onboarding/step3-reference.svg"
                    alt="Reference photo"
                    className="onboarding-compare-img"
                  />
                </div>
                <div className="onboarding-compare-panel">
                  <span className="onboarding-compare-tag">DRAWING</span>
                  <img
                    src="/onboarding/step3-drawing.svg"
                    alt="Drawing"
                    className="onboarding-compare-img"
                  />
                </div>
              </div>
              <div className="onboarding-actions">
                <button
                  type="button"
                  className="onboarding-btn-primary"
                  onClick={handleGetStartedFinal}
                >
                  Try it now
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
