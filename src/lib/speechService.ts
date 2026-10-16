/**
 * EduCore British English Speech Synthesis Service
 * Provides loud, natural British English (en-GB) read-aloud capabilities for learning resources.
 */

export interface SpeechVoiceInfo {
  name: string;
  lang: string;
  isBritish: boolean;
  voice: SpeechSynthesisVoice;
}

export interface SpeechPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentParagraphIndex: number;
  totalParagraphs: number;
  rate: number;
  volume: number;
  voiceName: string;
}

export interface SpeechCallbacks {
  onStart?: () => void;
  onParagraphChange?: (index: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

class BritishSpeechService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private paragraphs: string[] = [];
  private currentIdx = 0;
  private isSpeaking = false;
  private isPaused = false;
  private rate = 1.0;
  private volume = 1.0; // Loudly by default
  private callbacks: SpeechCallbacks = {};
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    this.selectedVoice = this.findBestBritishVoice();
  }

  public getVoices(): SpeechVoiceInfo[] {
    this.loadVoices();
    return this.voices.map(v => ({
      name: v.name,
      lang: v.lang,
      isBritish: this.isBritishVoice(v),
      voice: v
    }));
  }

  public getBritishVoices(): SpeechVoiceInfo[] {
    return this.getVoices().filter(v => v.isBritish);
  }

  private isBritishVoice(v: SpeechSynthesisVoice): boolean {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    const name = (v.name || '').toLowerCase();
    return (
      lang === 'en-gb' ||
      lang.startsWith('en-gb') ||
      name.includes('british') ||
      name.includes('united kingdom') ||
      name.includes('uk english') ||
      name.includes('daniel') ||
      name.includes('oliver') ||
      name.includes('george') ||
      name.includes('hazel') ||
      name.includes('serena') ||
      name.includes('stephanie')
    );
  }

  public findBestBritishVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.voices.length > 0 ? this.voices : this.synth.getVoices();
    
    // 1. Explicit en-GB voice
    const exactGb = voices.find(v => {
      const lang = (v.lang || '').toLowerCase().replace('_', '-');
      return lang === 'en-gb' && !v.name.toLowerCase().includes('network');
    });
    if (exactGb) return exactGb;

    // 2. Name match for British / UK
    const nameGb = voices.find(v => this.isBritishVoice(v));
    if (nameGb) return nameGb;

    // 3. Any en-GB
    const anyGb = voices.find(v => (v.lang || '').toLowerCase().includes('gb'));
    if (anyGb) return anyGb;

    // 4. Any English voice
    const anyEn = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
    return anyEn || voices[0] || null;
  }

  public setVoice(voice: SpeechSynthesisVoice) {
    this.selectedVoice = voice;
  }

  public setRate(newRate: number) {
    this.rate = Math.max(0.5, Math.min(2.0, newRate));
    // If currently speaking, restart current paragraph with new rate
    if (this.isSpeaking && !this.isPaused) {
      this.speakCurrentParagraph();
    }
  }

  public setVolume(newVolume: number) {
    this.volume = Math.max(0, Math.min(1.0, newVolume));
  }

  public getPlaybackState(): SpeechPlaybackState {
    return {
      isPlaying: this.isSpeaking,
      isPaused: this.isPaused,
      currentParagraphIndex: this.currentIdx,
      totalParagraphs: this.paragraphs.length,
      rate: this.rate,
      volume: this.volume,
      voiceName: this.selectedVoice?.name || 'British English (en-GB)'
    };
  }

  /**
   * Cleans and splits text into logical speech chunks (paragraphs/sentences)
   */
  public prepareChunks(rawText: string): string[] {
    if (!rawText || !rawText.trim()) return [];
    
    // Split by double newlines or single newlines
    const rawParagraphs = rawText
      .split(/\n\s*\n|\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const chunks: string[] = [];

    rawParagraphs.forEach(para => {
      // If paragraph is very long (> 280 chars), split by sentences to avoid browser speech timeout
      if (para.length > 280) {
        const sentences = para.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
        if (sentences && sentences.length > 1) {
          let buffer = '';
          sentences.forEach(s => {
            if ((buffer + ' ' + s).length > 220) {
              if (buffer.trim()) chunks.push(buffer.trim());
              buffer = s;
            } else {
              buffer = buffer ? `${buffer} ${s}` : s;
            }
          });
          if (buffer.trim()) chunks.push(buffer.trim());
        } else {
          chunks.push(para);
        }
      } else {
        chunks.push(para);
      }
    });

    return chunks.length > 0 ? chunks : [rawText.trim()];
  }

  /**
   * Starts reading aloud the provided text or array of chunks
   */
  public readAloud(
    content: string | string[],
    callbacks: SpeechCallbacks = {},
    startIndex = 0
  ) {
    this.stop();

    if (Array.isArray(content)) {
      this.paragraphs = content.filter(c => c && c.trim().length > 0);
    } else {
      this.paragraphs = this.prepareChunks(content);
    }

    if (this.paragraphs.length === 0) {
      if (callbacks.onEnd) callbacks.onEnd();
      return;
    }

    this.callbacks = callbacks;
    this.currentIdx = Math.max(0, Math.min(startIndex, this.paragraphs.length - 1));
    this.isSpeaking = true;
    this.isPaused = false;

    if (this.callbacks.onStart) {
      this.callbacks.onStart();
    }

    this.speakCurrentParagraph();
  }

  private speakCurrentParagraph() {
    if (!this.synth) {
      if (this.callbacks.onError) this.callbacks.onError(new Error('Speech synthesis not supported'));
      return;
    }

    if (this.currentIdx >= this.paragraphs.length) {
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      if (this.callbacks.onEnd) this.callbacks.onEnd();
      return;
    }

    const textToSpeak = this.paragraphs[this.currentIdx];
    if (!textToSpeak || !textToSpeak.trim()) {
      this.currentIdx++;
      this.speakCurrentParagraph();
      return;
    }

    // Cancel any previous utterance
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    // Enforce British English
    utterance.lang = 'en-GB';
    const voice = this.selectedVoice || this.findBestBritishVoice();
    if (voice) {
      utterance.voice = voice;
    }
    
    // Loud volume by default
    utterance.volume = this.volume;
    utterance.rate = this.rate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.isPaused = false;
      if (this.callbacks.onParagraphChange) {
        this.callbacks.onParagraphChange(this.currentIdx);
      }
    };

    utterance.onend = () => {
      if (!this.isSpeaking || this.isPaused) return;
      this.currentIdx++;
      if (this.currentIdx < this.paragraphs.length) {
        this.speakCurrentParagraph();
      } else {
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentUtterance = null;
        if (this.callbacks.onEnd) this.callbacks.onEnd();
      }
    };

    utterance.onerror = (e) => {
      // In some browsers cancel triggers error with 'canceled' or 'interrupted'
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      console.warn('Speech synthesis utterance error:', e);
      if (this.callbacks.onError) {
        this.callbacks.onError(e);
      }
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public pause() {
    if (!this.synth || !this.isSpeaking || this.isPaused) return;
    this.synth.pause();
    this.isPaused = true;
    if (this.callbacks.onPause) this.callbacks.onPause();
  }

  public resume() {
    if (!this.synth || !this.isSpeaking || !this.isPaused) return;
    this.synth.resume();
    this.isPaused = false;
    if (this.callbacks.onResume) this.callbacks.onResume();
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this.currentIdx = 0;
  }

  public jumpToParagraph(index: number) {
    if (index >= 0 && index < this.paragraphs.length) {
      this.currentIdx = index;
      if (this.isSpeaking) {
        this.speakCurrentParagraph();
      }
    }
  }
}

export const speechService = new BritishSpeechService();
