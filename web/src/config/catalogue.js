// Closed-set nursing action catalogue (design doc §7.5). Versioned, clinician-approved.
// Cards may ONLY contain actions from this list. hi/te strings are draft translations —
// get them verified by a native-speaking clinician before the demo.
export const CATALOGUE_VERSION = 'v1.0-demo';

export const CATALOGUE = {
  A01: { minutes: 2, triggers: ['rr_up', 'spo2_down'],
    en: 'Sit patient upright to 45°',
    hi: 'मरीज़ को 45° पर सीधा बैठाएँ',
    te: 'రోగిని 45° కోణంలో నిటారుగా కూర్చోబెట్టండి' },
  A02: { minutes: 3, triggers: ['spo2_down_on_o2'],
    en: 'Check oxygen cannula, mask and flow rate',
    hi: 'ऑक्सीजन कैनुला, मास्क और फ्लो रेट जाँचें',
    te: 'ఆక్సిజన్ కాన్యులా, మాస్క్, ఫ్లో రేటు తనిఖీ చేయండి' },
  A03: { minutes: 3, triggers: ['sbp_down', 'sbp_stale'],
    en: 'Repeat manual BP (other arm, correct cuff)',
    hi: 'मैनुअल बीपी दोबारा लें (दूसरी बाँह, सही कफ़)',
    te: 'మాన్యువల్ BP మళ్ళీ తీసుకోండి (మరో చేయి, సరైన కఫ్)' },
  A04: { minutes: 5, triggers: ['multi_stale'],
    en: 'Measure full set of vitals now',
    hi: 'अभी सभी वाइटल्स नापें',
    te: 'ఇప్పుడే అన్ని వైటల్స్ కొలవండి' },
  A05: { minutes: 3, triggers: ['temp'],
    en: 'Check temperature and look for rigors',
    hi: 'तापमान जाँचें और कंपकंपी देखें',
    te: 'ఉష్ణోగ్రత చూసి, వణుకు ఉందేమో గమనించండి' },
  A06: { minutes: 4, triggers: ['avpu'],
    en: 'Assess consciousness (AVPU) and blood glucose',
    hi: 'चेतना (AVPU) और ब्लड ग्लूकोज़ जाँचें',
    te: 'స్పృహ (AVPU), బ్లడ్ గ్లూకోజ్ అంచనా వేయండి' },
  A07: { minutes: 4, triggers: ['shock_index'],
    en: 'Check IV line, fluids running, urine output',
    hi: 'IV लाइन, चल रहे फ्लूइड और यूरिन आउटपुट जाँचें',
    te: 'IV లైన్, ద్రవాలు, మూత్ర విసర్జన తనిఖీ చేయండి' },
  A08: { minutes: 1, triggers: ['moderate_risk'],
    en: 'Increase observation frequency to hourly',
    hi: 'हर घंटे ऑब्ज़र्वेशन करें',
    te: 'ప్రతి గంటకు పరిశీలన పెంచండి' },
  A09: { minutes: 3, triggers: ['high_risk'],
    en: 'Page on-duty doctor (SBAR ready)',
    hi: 'ड्यूटी डॉक्टर को पेज करें (SBAR तैयार)',
    te: 'డ్యూటీ డాక్టర్‌ను పేజ్ చేయండి (SBAR సిద్ధం)' },
  A10: { minutes: 1, triggers: ['crash'],
    en: 'Call rapid-response / code team',
    hi: 'रैपिड रिस्पॉन्स / कोड टीम को बुलाएँ',
    te: 'రాపిడ్ రెస్పాన్స్ / కోడ్ టీమ్‌ను పిలవండి' },
  A11: { minutes: 1, triggers: ['unacked'],
    en: 'Inform charge nurse',
    hi: 'चार्ज नर्स को सूचित करें',
    te: 'చార్జ్ నర్స్‌కు తెలియజేయండి' },
};

export function actionText(code, lang = 'en') {
  const a = CATALOGUE[code];
  return a ? a[lang] || a.en : code;
}
