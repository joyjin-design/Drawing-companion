import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

const ONBOARDING_SESSION_KEY = "drawing-companion-onboarding-done-session";

function onboardingKeyForUser(userId: string): string {
  return `drawing-companion-onboarding-done-${userId}`;
}

export function setOnboardingDone(userId?: string): void {
  if (typeof window === "undefined") return;
  if (userId) {
    localStorage.setItem(onboardingKeyForUser(userId), "1");
  } else {
    sessionStorage.setItem(ONBOARDING_SESSION_KEY, "1");
  }
}

export function hasSeenOnboarding(authUser: { id: string } | null): boolean {
  if (typeof window === "undefined") return false;
  let result: boolean;
  let keyUsed: string;
  let rawValue: string | null;
  if (authUser) {
    keyUsed = onboardingKeyForUser(authUser.id);
    rawValue = localStorage.getItem(keyUsed);
    result = rawValue === "1";
  } else {
    keyUsed = ONBOARDING_SESSION_KEY;
    rawValue = sessionStorage.getItem(keyUsed);
    result = rawValue === "1";
  }
  // #region agent log
  fetch("http://127.0.0.1:7543/ingest/061dfdc9-29cb-4d00-8ed1-24635fe0b4c4", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c81602" }, body: JSON.stringify({ sessionId: "c81602", hypothesisId: "H1-H3", location: "Onboarding.tsx:hasSeenOnboarding", message: "hasSeenOnboarding", data: { authUserId: authUser?.id ?? null, keyUsed, rawValue, result }, timestamp: Date.now() }) }).catch(() => {});
  // #endregion
  return result;
}

export type OnboardingProps = {
  onFinish: () => void;
  onLogIn: () => void;
  onFinishAndStartCamera?: () => void;
  authUserId?: string | null;
};

export default function Onboarding({ onFinish, onLogIn, onFinishAndStartCamera, authUserId = null }: OnboardingProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  const handleSkip = () => {
    setOnboardingDone(authUserId ?? undefined);
    onFinish();
  };

  const handleBack = () => {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleLogIn = () => {
    setOnboardingDone(authUserId ?? undefined);
    onLogIn();
  };

  const handleGetStartedWelcome = () => setStep(1);
  const handleNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
  };
  const handleGetStartedFinal = () => {
    setOnboardingDone(authUserId ?? undefined);
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
              style={{ display: "none" }}
              aria-hidden
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
              Get started{" "}
              <svg
                className="onboarding-btn-icon"
                viewBox="0 0 448 512"
                fill="currentColor"
                aria-hidden
              >
                <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
              </svg>
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
              <FontAwesomeIcon icon={faArrowLeft} aria-hidden />
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
                  src="/onboarding/step1-daisy.png"
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
                  Next{" "}
                  <svg
                    className="onboarding-btn-icon"
                    viewBox="0 0 448 512"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
                  </svg>
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
                {/* Step 2: hand drawing — always use step2-drawing.png */}
                <img
                  src="/onboarding/step2-drawing.png"
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
                  Next{" "}
                  <svg
                    className="onboarding-btn-icon"
                    viewBox="0 0 448 512"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
                  </svg>
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
                    src="/onboarding/step1-daisy.png"
                    alt="Daisy in vase"
                    className="onboarding-compare-img"
                  />
                </div>
                <div className="onboarding-compare-panel">
                  <span className="onboarding-compare-tag">DRAWING</span>
                  <img
                    src="/onboarding/step2-drawing.png"
                    alt="Hand drawing"
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
