import { db } from '../lib/firebase';
import { getDoc, doc } from 'firebase/firestore';

// 기본 금칙어 (Firestore에 없을 경우 fallback)
const DEFAULT_BAD_WORDS = ['시발', '씨발', '개새끼', '미친놈', '병신', '지랄', '좆', '썅'];

let cachedBadWords: string[] | null = null;
let cacheTime = 0;

// 금칙어 목록 가져오기 (60초 캐시)
export const getBadWords = async (): Promise<string[]> => {
  const now = Date.now();
  if (cachedBadWords && now - cacheTime < 60000) return cachedBadWords;
  try {
    const snap = await getDoc(doc(db, 'settings', 'profanity'));
    cachedBadWords = snap.exists() ? (snap.data().words as string[]) : DEFAULT_BAD_WORDS;
    cacheTime = now;
    return cachedBadWords;
  } catch {
    return DEFAULT_BAD_WORDS;
  }
};

// 캐시 초기화 (관리자가 목록 수정 후 호출)
export const clearBadWordsCache = () => {
  cachedBadWords = null;
};

export const filterBadWords = (
  text: string,
  badWords: string[] = DEFAULT_BAD_WORDS
): { filteredText: string; hasBadWords: boolean } => {
  let filteredText = text;
  let hasBadWords = false;

  badWords.forEach(word => {
    if (!word.trim()) return;
    const regex = new RegExp(word.trim(), 'gi');
    if (regex.test(filteredText)) {
      hasBadWords = true;
      filteredText = filteredText.replace(regex, '○'.repeat(word.length));
    }
  });

  return { filteredText, hasBadWords };
};
