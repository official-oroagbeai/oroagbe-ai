export type Language = 'en' | 'yo';
export type AppMode = 'farmer' | 'extension';

export const DICTIONARY = {
  en: {
    title: 'OroAgbe AI',
    tagline: 'Climate Intelligence Infrastructure for Nigerian Agriculture',
    farmerMode: 'Farmer View',
    extensionMode: 'Extension / Field Agronomist View',
    locationLabel: 'Osun Agricultural Zone / LGA:',
    cropLabel: 'Pilot Crop:',
    cropAll: 'General Advisory',
    cassava: 'Cassava (Gbágùdá)',
    maize: 'Maize (Àgbàdo)',
    yam: 'Yam (Iṣu)',
    cocoa: 'Cocoa (Kòkó)',
    inputPlaceholder: 'Ask about planting calendars, fertilizer dosing, or pest & spray windows...',
    sendButton: 'Send Inquiry',
    stopButton: 'Halt Stream',
    clearChat: 'Reset Session',
    offlineBanner: 'Offline Mode: Browsing locally cached climate advisories.',
    safetyAlertTitle: 'CRITICAL CLIMATE & AGRONOMIC SAFETY NOTICE',
    readAloud: 'Read Aloud (Yorùbá Audio)',
    telemetryTitle: 'Grounding Telemetry & Audit Stream',
    quickPromptsHeading: 'Climate-Adaptive Quick Inquiries:',
    quickPrompts: [
      { 
        label: 'Maize Fertilizer & Leaching Risk', 
        query: 'What is the safe NPK dosage for maize, and should I apply it given the current rainfall forecast?' 
      },
      { 
        label: 'Cassava Cutting Envelopes', 
        query: 'What is the recommended stem cutting length and angle to prevent rot in high-moisture soils?' 
      },
      { 
        label: 'Fall Armyworm Spray Conditions', 
        query: 'Are current wind velocity and humidity levels suitable for pesticide spraying on maize?' 
      },
      { 
        label: 'Yam Mound Preparation', 
        query: 'How high should yam ridges be in deep loamy soil to promote tuber aeration and drainage?' 
      }
    ]
  },
  yo: {
    title: 'OroAgbe AI',
    tagline: 'Ẹ̀rọ Ìmọ̀ Ọjọ́ àti Iṣẹ́-Àgbẹ̀ fún Ilẹ̀ Nàìjíríà',
    farmerMode: 'Ojú Ìwòye Àgbẹ̀',
    extensionMode: 'Ojú Ìwòye Olùkọ́-Àgbẹ̀ (Extension Officer)',
    locationLabel: 'Agbègbè / Ìjọba Ìbílẹ̀ Ọ̀ṣun:',
    cropLabel: 'Irúgbìn:',
    cropAll: 'Gbogbo Irúgbìn',
    cassava: 'Gbágùdá',
    maize: 'Àgbàdo',
    yam: 'Iṣu',
    cocoa: 'Kòkó',
    inputPlaceholder: 'Béèrè nípa àsìkò gbíngbìn, ajílẹ̀, tàbí fífún oògùn ní ìbámu pẹ̀lú ojú-ọjọ́...',
    sendButton: 'Fúnsọ́rọ̀',
    stopButton: 'Dá A Dúró',
    clearChat: 'Pa Ọ̀rọ̀ Rẹ́',
    offlineBanner: 'Àìsí Íńtánẹ́ẹ̀tì: Ìmọ̀ràn tí a ti fipamọ́ tẹ́lẹ̀ nìkan ló wà.',
    safetyAlertTitle: 'ÌKILỌ̀ PÀTÀKÌ NÍPA ÀÀBÒ ÀTI OJÚ-ỌJỌ́',
    readAloud: 'Gbọ́ Ọ̀rọ̀ Yìí (Audio)',
    telemetryTitle: 'Àwọn Ẹ̀rí Ìmọ̀ràn & Ìṣirò Ìdáwọ́le',
    quickPromptsHeading: 'Àwọn Ìbéèrè Tó Bára Mu Lónìí:',
    quickPrompts: [
      { 
        label: 'Ìwọ̀n Ajílẹ̀ Àgbàdo & Òjò', 
        query: 'Kí ni ìwọ̀n NPK tó tọ́ fún àgbàdo, ṣé mo lè lò ó pẹ̀lú bí ojú-ọjọ́ ṣe rí yìí láìsí pé òjò fọ̀ ọ́ dànù?' 
      },
      { 
        label: 'Gígùn Igi Gbágùdá', 
        query: 'Báwo ni igi gbágùdá ṣe gbọ́dọ̀ gùn tó àti igun wo ni kí n gbìn ín kí ó má baà jẹrà?' 
      },
      { 
        label: 'Fífún Oògùn Kòkòrò Àgbàdo', 
        query: 'Ṣé afẹ́fẹ́ àti ọ̀rinrin lónìí dára fún fífún egbòogi kòkòrò Fall Armyworm?' 
      },
      { 
        label: 'Kíkọ Ebe Iṣu fún Ọ̀rinrin', 
        query: 'Gíga wo ni ebe iṣu gbọ́dọ̀ ní nínú ilẹ̀ tó rọ̀ kí omi má ṣe dúró sí i lẹ́sẹ̀?' 
      }
    ]
  }
};