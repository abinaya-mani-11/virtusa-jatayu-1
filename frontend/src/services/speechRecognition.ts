// Service wrapper for Web Speech API with engine awareness and offline indicators

export interface SpeechRecognitionState {
  isSupported: boolean;
  isListening: boolean;
  isPaused: boolean;
  transcript: string;
  durationSeconds: number;
  engineType: "Browser/OS Speech Engine" | "Not Supported";
  isLocalEngine: boolean;
  errorMessage?: string;
}

export class SpeechRecognitionManager {
  private recognition: any = null;
  private isListening = false;
  private isPaused = false;
  private durationSeconds = 0;
  private timerInterval: any = null;
  private onStateChange: (state: SpeechRecognitionState) => void;
  private accumulatedTranscript = "";

  constructor(onStateChange: (state: SpeechRecognitionState) => void) {
    this.onStateChange = onStateChange;
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";

        this.recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + " ";
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            this.accumulatedTranscript += finalTranscript;
          }

          const currentTotal = (this.accumulatedTranscript + interimTranscript).trim();
          this.emitState({ transcript: currentTotal });
        };

        this.recognition.onerror = (event: any) => {
          console.warn("Speech recognition warning/error:", event.error);
          let userMessage = event.error;
          if (event.error === "not-allowed") {
            userMessage = "Microphone access blocked. Please enable mic permissions or type notes manually.";
          } else if (event.error === "network") {
            userMessage = "Browser speech recognition requires network connectivity. Offline fallback to manual text entry is fully functional.";
          }
          this.emitState({ errorMessage: userMessage });
        };

        this.recognition.onend = () => {
          if (this.isListening && !this.isPaused) {
            // Auto-restart if still actively listening
            try {
              this.recognition.start();
            } catch (e) {
              // Ignore restart error
            }
          }
        };
      } catch (err) {
        console.error("Speech init failure:", err);
      }
    }
    this.emitState();
  }

  public isSupported(): boolean {
    return Boolean(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  public start() {
    if (!this.recognition) return;
    try {
      this.accumulatedTranscript = "";
      this.durationSeconds = 0;
      this.isListening = true;
      this.isPaused = false;
      this.recognition.start();

      this.timerInterval = setInterval(() => {
        if (!this.isPaused) {
          this.durationSeconds += 1;
          this.emitState();
        }
      }, 1000);

      this.emitState({ errorMessage: undefined });
    } catch (e: any) {
      this.emitState({ errorMessage: e.message || "Failed to start audio recording" });
    }
  }

  public pause() {
    if (!this.isListening) return;
    this.isPaused = true;
    try {
      this.recognition.stop();
    } catch (e) {}
    this.emitState();
  }

  public resume() {
    if (!this.isListening) return;
    this.isPaused = false;
    try {
      this.recognition.start();
    } catch (e) {}
    this.emitState();
  }

  public stop(): string {
    this.isListening = false;
    this.isPaused = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.emitState();
    return this.accumulatedTranscript.trim();
  }

  public clear() {
    this.accumulatedTranscript = "";
    this.durationSeconds = 0;
    this.emitState({ transcript: "" });
  }

  private emitState(overrides?: Partial<SpeechRecognitionState>) {
    const supported = this.isSupported();
    this.onStateChange({
      isSupported: supported,
      isListening: this.isListening,
      isPaused: this.isPaused,
      transcript: overrides?.transcript !== undefined ? overrides.transcript : this.accumulatedTranscript,
      durationSeconds: this.durationSeconds,
      engineType: supported ? "Browser/OS Speech Engine" : "Not Supported",
      isLocalEngine: false, // Explicitly documented as browser-dependent
      errorMessage: overrides?.errorMessage,
      ...overrides
    });
  }
}
