import { db, storage } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { AdBanner } from './api';
export type { AdBanner };

export interface MarketItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  imageUrls?: string[];
}

export interface SiteSettings {
  logoUrl?: string;
  siteTitle?: string;       // 브라우저 탭 제목
  faviconUrl?: string;      // 파비콘 URL
  odongPerPost: number;
  odongPerComment: number;
  defaultAnonSuffix: string;
  profanityAction: 'mask' | 'block';
  likeName: string;
  dislikeName: string;
  popularPostThreshold: number;
  juksilThreshold: number;
  popularBoardId?: string; // 인기게시판 지정 ID (default: 'juksil')
  homeWidgets?: string[];  // 메인 페이지 표시 요소 (e.g. ['notice', 'popular_juksil', 'recent_free'])
  marketName?: string;     // 마켓 이름
  marketItems?: MarketItem[]; // 마켓 아이템 목록
}

export interface BoardSettings {
  id: string;
  name: string;
  description: string;
  type: 'normal' | 'popular' | 'anon';
  headerInfo?: string;
  footerInfo?: string;
  allowComments: boolean;
  allowVotes: boolean;
  allowUserPost: boolean;
  allowUserComment: boolean;
  prefixes: string[];  // 말머리 목록 e.g. ['[질문]', '[정보]', '[잡담]']
}

// ─── Upload ───────────────────────────────────────────────
export const uploadFile = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

// ─── Site Settings ────────────────────────────────────────
export const getSiteSettings = async (): Promise<SiteSettings> => {
  const docSnap = await getDoc(doc(db, 'settings', 'general'));
  if (docSnap.exists()) {
    return {
      odongPerPost: 10,
      odongPerComment: 5,
      defaultAnonSuffix: '봉군',
      profanityAction: 'mask',
      likeName: '대봉황',
      dislikeName: '닭둘기',
      popularPostThreshold: 5,
      juksilThreshold: 10,
      ...docSnap.data(),
    } as SiteSettings;
  }
  return {
    odongPerPost: 10,
    odongPerComment: 5,
    defaultAnonSuffix: '봉군',
    profanityAction: 'mask',
    likeName: '대봉황',
    dislikeName: '닭둘기',
    popularPostThreshold: 5,
    juksilThreshold: 10,
  };
};

const sanitizeData = (val: any): any => {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    return val.map(sanitizeData);
  }
  if (typeof val === 'object') {
    if (Object.getPrototypeOf(val) !== Object.prototype) {
      return val;
    }
    const res: any = {};
    for (const key of Object.keys(val)) {
      if (val[key] !== undefined) {
        res[key] = sanitizeData(val[key]);
      }
    }
    return res;
  }
  return val;
};

export const updateSiteSettings = async (settings: Partial<SiteSettings>) => {
  const cleanSettings = sanitizeData(settings);
  await setDoc(doc(db, 'settings', 'general'), cleanSettings, { merge: true });
};

// ─── Profanity List ───────────────────────────────────────
export const getProfanityList = async (): Promise<string[]> => {
  const docSnap = await getDoc(doc(db, 'settings', 'profanity'));
  if (docSnap.exists()) {
    return docSnap.data().words as string[];
  }
  // 기본 리스트
  return ['시발', '씨발', '개새끼', '미친놈', '병신', '지랄', '좆', '썅'];
};

export const updateProfanityList = async (words: string[]) => {
  await setDoc(doc(db, 'settings', 'profanity'), { words });
};

// ─── Board Settings ───────────────────────────────────────
export const getBoardSettings = async (boardId: string): Promise<BoardSettings | null> => {
  const docSnap = await getDoc(doc(db, 'boards', boardId));
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: boardId,
      name: data.name || '',
      description: data.description || '',
      type: data.type || 'normal',
      allowComments: data.allowComments ?? true,
      allowVotes: data.allowVotes ?? true,
      allowUserPost: data.allowUserPost ?? true,
      allowUserComment: data.allowUserComment ?? true,
      prefixes: data.prefixes || [],
      headerInfo: data.headerInfo || '',
      footerInfo: data.footerInfo || '',
    };
  }
  return null;
};

export const updateBoardSettings = async (boardId: string, settings: Partial<BoardSettings>) => {
  const boardRef = doc(db, 'boards', boardId);
  
  // undefined 값 제거
  const safeSettings: any = { ...settings };
  Object.keys(safeSettings).forEach(key => {
    if (safeSettings[key] === undefined) {
      delete safeSettings[key];
    }
  });

  await setDoc(boardRef, safeSettings, { merge: true });
};

export const createBoard = async (boardId: string, name: string) => {
  const boardRef = doc(db, 'boards', boardId);
  await setDoc(boardRef, {
    id: boardId,
    name,
    description: '',
    type: 'normal',
    allowComments: true,
    allowVotes: true,
    allowUserPost: true,
    allowUserComment: true,
    prefixes: [],
  });
};

export const deleteBoard = async (boardId: string) => {
  const boardRef = doc(db, 'boards', boardId);
  await deleteDoc(boardRef);
};

// Legacy alias
export const updateBoardMeta = async (
  boardId: string,
  name: string,
  headerInfo: string,
  footerInfo: string
) => {
  await updateBoardSettings(boardId, { name, headerInfo, footerInfo });
};

// ─── Ad Banners ───────────────────────────────────────────
export const createAdBanner = async (adData: Omit<AdBanner, 'id' | 'active' | 'createdAt'>) => {
  await addDoc(collection(db, 'ads'), {
    ...adData,
    active: true,
    createdAt: serverTimestamp(),
  });
};

export const getAdBanners = async (): Promise<AdBanner[]> => {
  const q = query(collection(db, 'ads'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdBanner));
};

export const toggleAdBanner = async (adId: string, active: boolean) => {
  await updateDoc(doc(db, 'ads', adId), { active });
};

export const deleteAdBanner = async (adId: string) => {
  await deleteDoc(doc(db, 'ads', adId));
};

// ─── User Management ──────────────────────────────────────
export interface UserRecord {
  uid: string;
  email: string | null;
  nickname: string;
  role: 'admin' | 'user';
  odong: number;
  isBanned: boolean;
  purchasedStickers?: string[];
}

export const getUsers = async (): Promise<UserRecord[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(d => ({
    uid: d.id,
    email: d.data().email || null,
    nickname: d.data().nickname || '',
    role: d.data().role || 'user',
    odong: d.data().odong || 0,
    isBanned: d.data().isBanned || false,
    purchasedStickers: d.data().purchasedStickers || [],
  }));
};

export const updateUserRole = async (uid: string, role: 'admin' | 'user') => {
  await updateDoc(doc(db, 'users', uid), { role });
};

export const toggleUserBan = async (uid: string, isBanned: boolean) => {
  await updateDoc(doc(db, 'users', uid), { isBanned });
};

// ─── Footer Documents (하단 문서) ─────────────────────────
export interface FooterDocument {
  id?: string;
  title: string;
  slug: string;  // URL-friendly key, e.g. 'terms', 'faq', 'privacy'
  content: string;  // HTML content from RichEditor
  order: number;
  createdAt: any;
}

export const getFooterDocuments = async (): Promise<FooterDocument[]> => {
  const q = query(collection(db, 'footer_documents'), orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FooterDocument));
};

export const getFooterDocument = async (slug: string): Promise<FooterDocument | null> => {
  const q = query(collection(db, 'footer_documents'), where('slug', '==', slug));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FooterDocument;
};

export const createFooterDocument = async (doc_data: Omit<FooterDocument, 'id' | 'createdAt'>) => {
  await addDoc(collection(db, 'footer_documents'), {
    ...doc_data,
    createdAt: serverTimestamp(),
  });
};

export const updateFooterDocument = async (docId: string, data: Partial<FooterDocument>) => {
  const ref = doc(db, 'footer_documents', docId);
  const safeData: any = { ...data };
  Object.keys(safeData).forEach(key => { if (safeData[key] === undefined) delete safeData[key]; });
  await updateDoc(ref, safeData);
};

export const deleteFooterDocument = async (docId: string) => {
  await deleteDoc(doc(db, 'footer_documents', docId));
};
