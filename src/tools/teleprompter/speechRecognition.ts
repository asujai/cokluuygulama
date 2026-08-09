import { SampleSpeech } from './types';

/**
 * Built-in sample speeches in Turkish across popular categories:
 * - YouTube / Vlog Girişi
 * - İş & Startup Pitch Sunumu
 * - Motivasyonel Konuşma
 * - Haber & Bülten Sunumu
 */
export const SAMPLE_SPEECHES: SampleSpeech[] = [
  {
    id: 'sample_vlog',
    title: 'YouTube & Vlog Açılışı',
    category: 'İçerik Üretimi',
    durationEst: '1 dk 15 sn',
    script: `Herkese merhaba arkadaşlar, kanalıma ve yeni videoma hepiniz hoş geldiniz!

Bugün sizlerle birlikte günlük hayatımızı inanılmaz derecede kolaylaştıran harika mobil araçları ve verimlilik ipuçlarını adım adım inceleyeceğiz.

Videoya geçmeden önce kanala abone olmayı, videoyu beğenmeyi ve aklınıza takılan soruları yorumlar kısmında paylaşmayı unutmayın.

Hazırsanız, lafı hiç uzatmadan ilk aracımızla doğrudan başlayalım!`,
  },
  {
    id: 'sample_business_pitch',
    title: 'Girişim & Yatırımcı Sunumu',
    category: 'İş & Girişimcilik',
    durationEst: '1 dk 40 sn',
    script: `Değerli konuklar ve kıymetli jüri üyeleri, hepinize merhaba.

Günümüzde bireyler ve ekipler onlarca farklı uygulama arasında kayboluyor, zaman ve odak kaybediyor.

Bizler Gundelik platformuyla, tüm temel ve gelişmiş araçları tek bir güvenli, %100 çevrimdışı ve gizlilik odaklı mimaride birleştirdik.

Kullanıcı verilerini hiçbir sunucuya göndermeden, doğrudan cihaz donanımının tüm gücünü kullanarak saniyeler içinde sonuç üretiyoruz.

Gelin şimdi hep birlikte büyüme rakamlarımıza ve gelecek yol haritamıza göz atalım.`,
  },
  {
    id: 'sample_motivation',
    title: 'Motivasyonel Konuşma',
    category: 'Kişisel Gelişim',
    durationEst: '1 dk 30 sn',
    script: `Büyük hedeflere ulaşmanın sırrı, mükemmel zamanı beklemekte değil, şu an elindeki imkanlarla ilk adımı atmakta yatar.

Her gün attığın küçük ve kararlı adımlar, bir yıl sonra seni hayal bile edemeyeceğin noktalara taşır.

Zorluklar ve engeller seni durdurmak için değil, ne kadar kararlı olduğunu test etmek için karşına çıkar.

Kendine inan, disiplini elden bırakma ve bugün başla!`,
  },
  {
    id: 'sample_news',
    title: 'Teknoloji Bülteni Açılışı',
    category: 'Medya & Haber',
    durationEst: '1 dk 20 sn',
    script: `İyi günler değerli izleyiciler, Teknoloji ve Dijital Dönüşüm Bülteni ile karşınızdayız.

Bugün bültenimizde; yapay zeka alanındaki en son on-device inovasyonlar, kullanıcı gizliliğini temel alan yeni nesil mobil mimariler ve sektördeki son gelişmeleri aktaracağız.

Günün öne çıkan ilk başlığı ile bültenimize başlıyoruz.`,
  },
];

/**
 * Checks if the Web Speech Recognition API is supported in current environment.
 */
export function isSpeechRecognitionAvailable(): boolean {
  if (typeof window !== 'undefined') {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
  return false;
}

export type WordMatchCallback = (wordIndex: number, progressRatio: number) => void;

export class VoiceFollowController {
  private recognition: any = null;
  private words: string[] = [];
  private currentMatchIndex: number = 0;
  private onMatch: WordMatchCallback | null = null;
  private isRunning: boolean = false;

  constructor(script: string, onMatch: WordMatchCallback) {
    this.words = this.cleanWords(script);
    this.onMatch = onMatch;
    this.initRecognition();
  }

  private cleanWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return;

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'tr-TR';

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interimTranscript += event.results[i][0].transcript;
        }

        this.processSpokenTranscript(interimTranscript);
      };

      this.recognition.onerror = (err: any) => {
        console.warn('Voice-follow recognition notice:', err);
      };
    } catch (e) {
      console.warn('Speech recognition init notice:', e);
    }
  }

  private processSpokenTranscript(transcript: string) {
    const spokenWords = this.cleanWords(transcript);
    if (spokenWords.length === 0 || this.words.length === 0) return;

    const lastSpoken = spokenWords[spokenWords.length - 1];

    // Search for match starting near current index up to 10 words forward
    const lookahead = Math.min(this.words.length, this.currentMatchIndex + 12);
    for (let i = Math.max(0, this.currentMatchIndex - 2); i < lookahead; i++) {
      if (this.words[i] && (this.words[i] === lastSpoken || this.words[i].includes(lastSpoken))) {
        this.currentMatchIndex = i;
        const progressRatio = this.words.length > 0 ? (i + 1) / this.words.length : 0;
        if (this.onMatch) {
          this.onMatch(i, progressRatio);
        }
        break;
      }
    }
  }

  public start() {
    if (this.recognition && !this.isRunning) {
      try {
        this.recognition.start();
        this.isRunning = true;
      } catch (err) {
        console.warn('Voice follow start warning:', err);
      }
    }
  }

  public stop() {
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop();
      } catch {}
      this.isRunning = false;
    }
  }

  public updateScript(script: string) {
    this.words = this.cleanWords(script);
    this.currentMatchIndex = 0;
  }
}
