import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  increment,
  updateDoc,
  deleteDoc,
  arrayUnion
} from 'firebase/firestore';
import { getBadWords, filterBadWords } from '../utils/filter';
import { generateSalt, hashPassword } from '../utils/crypto';

export interface Board {
  id: string;
  name: string;
  description: string;
  type: 'normal' | 'popular' | 'anon';
  minLikes?: number;
  allowComments?: boolean;
  allowVotes?: boolean;
  allowUserPost?: boolean;
  allowUserComment?: boolean;
  prefixes?: string[];
  headerInfo?: string;
  footerInfo?: string;
}

export interface Post {
  id?: string;
  postId: number;
  boardId: string;
  boardName?: string; // for juksil display
  title: string;
  prefix?: string; // 말머리
  content: string;
  authorUid: string | null;
  authorName: string;
  authorPassword?: string;
  authorSalt?: string;
  likes: number;
  dislikes: number;
  views: number;
  commentCount: number;
  createdAt: any;
  promotedToPopular?: boolean;
}

export interface Comment {
  id?: string;
  postId: string;
  authorUid: string | null;
  authorName: string;
  authorPassword?: string;
  authorSalt?: string;
  content: string;
  likes: number;
  dislikes: number;
  createdAt: any;
}

export interface AdBanner {
  id?: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  createdAt: any;
}

// ─── Boards ───────────────────────────────────────────────
export const getBoards = async (): Promise<Board[]> => {
  const snapshot = await getDocs(collection(db, 'boards'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Board));
};

export const getBoardRankings = async (): Promise<{ board: Board; postCount: number }[]> => {
  const boards = await getBoards();
  const countersSnap = await getDocs(collection(db, 'counters'));
  const counts: Record<string, number> = {};
  countersSnap.forEach(doc => {
    const id = doc.id; // e.g., 'board_free'
    if (id.startsWith('board_')) {
      const boardId = id.replace('board_', '');
      counts[boardId] = doc.data().lastPostId || 0;
    }
  });

  return boards
    .map(board => ({
      board,
      postCount: counts[board.id] || 0
    }))
    .sort((a, b) => b.postCount - a.postCount);
};

// ─── Posts ────────────────────────────────────────────────
export const getPostsByBoard = async (boardId: string, limitCount = 50): Promise<Post[]> => {
  const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const popularBoardId = settings.popularBoardId || 'juksil';

  if (boardId === popularBoardId) {
    // 인기게시판: boardId가 popularBoardId인 복사글만 최신순으로 조회
    const q = query(
      collection(db, 'posts'),
      where('boardId', '==', popularBoardId),
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
    return posts.sort((a, b) => (b.postId || 0) - (a.postId || 0)).slice(0, limitCount);
  } else {
    // 일반 게시판
    const q = query(
      collection(db, 'posts'),
      where('boardId', '==', boardId),
      // 복합 색인 에러를 피하기 위해 orderBy('postId', 'desc') 제거
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
    // 클라이언트단 메모리 정렬
    return posts.sort((a, b) => (b.postId || 0) - (a.postId || 0)).slice(0, limitCount);
  }
};

export const getPopularPosts = async (boardId: string, threshold: number, limitCount = 5): Promise<Post[]> => {
  // 복합 인덱스 에러 방지: 좋아요 수 기준으로 전역 조회 후 클라이언트에서 게시판 필터링
  const q = query(
    collection(db, 'posts'),
    where('likes', '>=', threshold),
    orderBy('likes', 'desc'),
    limit(100)
  );
  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
  return posts
    .filter(p => p.boardId === boardId)
    .slice(0, limitCount);
};

export const getRecentPosts = async (limitCount = 5): Promise<Post[]> => {
  const q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
};

export const getRecentPostsByBoard = async (boardId: string, limitCount = 5): Promise<Post[]> => {
  const q = query(
    collection(db, 'posts'),
    where('boardId', '==', boardId),
    limit(limitCount * 2)
  );
  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
  return posts.sort((a, b) => (b.postId || 0) - (a.postId || 0)).slice(0, limitCount);
};

export const createPost = async (
  postData: Omit<Post, 'id' | 'postId' | 'createdAt' | 'likes' | 'dislikes' | 'views' | 'commentCount'>
) => {
  const counterRef = doc(db, 'counters', `board_${postData.boardId}`);
  const postRef = doc(collection(db, 'posts'));

  // Firestore에서 금칙어 목록 가져와서 필터링
  const badWords = await getBadWords();
  const titleFilter = filterBadWords(postData.title, badWords);
  const contentFilter = filterBadWords(postData.content, badWords);

  const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
  const profanityAction = settingsDoc.exists()
    ? settingsDoc.data().profanityAction || 'mask'
    : 'mask';

  if (profanityAction === 'block' && (titleFilter.hasBadWords || contentFilter.hasBadWords)) {
    throw new Error('PROFANITY_DETECTED');
  }

  const boardSnap = await getDoc(doc(db, 'boards', postData.boardId));
  if (!boardSnap.exists()) {
    throw new Error('BOARD_NOT_FOUND');
  }

  await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const nextPostId = counterDoc.exists() ? (counterDoc.data().lastPostId || 0) + 1 : 1;
    if (counterDoc.exists()) {
      transaction.update(counterRef, { lastPostId: nextPostId });
    } else {
      transaction.set(counterRef, { lastPostId: nextPostId });
    }

    const newPost: any = {
      ...postData,
      title: titleFilter.filteredText,
      content: contentFilter.filteredText,
      postId: nextPostId,
      likes: 0,
      dislikes: 0,
      views: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
    };

    if (postData.authorPassword) {
      const salt = generateSalt();
      newPost.authorSalt = salt;
      // Note: We cannot await inside the synchronous part of runTransaction easily without changing the flow, 
      // but since we await outside it is fine. Wait, runTransaction callback is async.
      newPost.authorPassword = await hashPassword(postData.authorPassword, salt);
    }
    
    // Firestore는 undefined를 허용하지 않으므로 제거
    Object.keys(newPost).forEach(key => {
      if (newPost[key] === undefined) {
        delete newPost[key];
      }
    });

    transaction.set(postRef, newPost);
  });

  if (postData.authorUid) {
    const odong = settingsDoc.exists() ? (settingsDoc.data().odongPerPost ?? 10) : 10;
    const userRef = doc(db, 'users', postData.authorUid);
    await runTransaction(db, async (t) => {
      t.update(userRef, { odong: increment(odong) });
    });
  }
};

export const getPost = async (boardId: string, postId: number): Promise<Post | null> => {
  const q = query(
    collection(db, 'posts'),
    where('boardId', '==', boardId),
    where('postId', '==', postId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  runTransaction(db, async (t) => {
    t.update(docSnap.ref, { views: increment(1) });
  });
  return { id: docSnap.id, ...docSnap.data() } as Post;
};

export const votePost = async (docId: string, type: 'like' | 'dislike') => {
  const postRef = doc(db, 'posts', docId);
  const field = type === 'like' ? 'likes' : 'dislikes';

  await runTransaction(db, async (t) => {
    t.update(postRef, { [field]: increment(1) });
  });

  // 좋아요 시 인기게시판 자동 등재 처리
  if (type === 'like') {
    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const popularBoardId = settings.popularBoardId || 'juksil';
    const threshold = settings.juksilThreshold ?? 10;

    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const postData = postSnap.data() as Post;
    // runTransaction 이후 읽은 값이므로 postData.likes는 이미 +1된 최신값
    const currentLikes = postData.likes || 0;

    // 원본 게시글이 이미 인기게시판 게시글이면 중복 등재 방지
    if (postData.boardId === popularBoardId) return;

    console.log(`[Juksil Debug] boardId: ${postData.boardId}, currentLikes: ${currentLikes}, threshold: ${threshold}, promotedToPopular: ${postData.promotedToPopular}`);

    // 기준치에 정확히 도달한 시점에만 복사 (이미 복사된 글 방지)
    if (currentLikes >= threshold && !postData.promotedToPopular) {
      console.log(`[Juksil Debug] Threshold met! Copying post ${docId} to ${popularBoardId}`);
      const popCounterRef = doc(db, 'counters', `board_${popularBoardId}`);
      const newPostRef = doc(collection(db, 'posts'));

      await runTransaction(db, async (t) => {
        const latestPostSnap = await t.get(postRef);
        if (!latestPostSnap.exists()) return;
        const latestPost = latestPostSnap.data() as Post;
        if (latestPost.promotedToPopular) return;

        const counterDoc = await t.get(popCounterRef);
        const nextPostId = counterDoc.exists() ? (counterDoc.data().lastPostId || 0) + 1 : 1;
        if (counterDoc.exists()) {
          t.update(popCounterRef, { lastPostId: nextPostId });
        } else {
          t.set(popCounterRef, { lastPostId: nextPostId });
        }

        const originLink = `<p><a href="/${postData.boardId}/${postData.postId}" target="_blank" style="font-size:0.85em;color:gray;">📌 원본글 바로가기 (${postData.boardId})</a></p><hr/>`;

        const copyPost: any = {
          boardId: popularBoardId,
          title: postData.title,
          content: originLink + (postData.content || ''),
          authorUid: postData.authorUid || null,
          authorName: postData.authorName,
          prefix: postData.prefix || null,
          postId: nextPostId,
          likes: currentLikes,
          dislikes: postData.dislikes || 0,
          views: postData.views || 0,
          commentCount: 0,
          createdAt: serverTimestamp(),
          originBoardId: postData.boardId,
          originPostId: postData.postId,
        };

        Object.keys(copyPost).forEach(key => {
          if (copyPost[key] === undefined || copyPost[key] === null) {
            delete copyPost[key];
          }
        });

        t.update(postRef, { promotedToPopular: true });
        t.set(newPostRef, copyPost);
      });
    }
  }
};

export const updatePost = async (
  docId: string,
  postData: { title: string; content: string; prefix?: string }
) => {
  const postRef = doc(db, 'posts', docId);

  const badWords = await getBadWords();
  const titleFilter = filterBadWords(postData.title, badWords);
  const contentFilter = filterBadWords(postData.content, badWords);

  const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
  const profanityAction = settingsDoc.exists()
    ? settingsDoc.data().profanityAction || 'mask'
    : 'mask';

  if (profanityAction === 'block' && (titleFilter.hasBadWords || contentFilter.hasBadWords)) {
    throw new Error('PROFANITY_DETECTED');
  }

  const updateData: any = {
    title: titleFilter.filteredText,
    content: contentFilter.filteredText,
  };
  if (postData.prefix !== undefined) {
    updateData.prefix = postData.prefix;
  }

  await updateDoc(postRef, updateData);
};

export const deletePost = async (docId: string) => {
  const postRef = doc(db, 'posts', docId);
  await deleteDoc(postRef);
};

// ─── Comments ─────────────────────────────────────────────
export const getComments = async (postDocId: string): Promise<Comment[]> => {
  const q = query(
    collection(db, 'posts', postDocId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
};

export const createComment = async (
  postDocId: string,
  commentData: Omit<Comment, 'id' | 'postId' | 'createdAt' | 'likes' | 'dislikes'>
) => {
  const postRef = doc(db, 'posts', postDocId);
  const commentsRef = collection(postRef, 'comments');

  const badWords = await getBadWords();
  const contentFilter = filterBadWords(commentData.content, badWords);

  const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
  const profanityAction = settingsDoc.exists()
    ? settingsDoc.data().profanityAction || 'mask'
    : 'mask';

  if (profanityAction === 'block' && contentFilter.hasBadWords) {
    throw new Error('PROFANITY_DETECTED');
  }

  const odong = settingsDoc.exists() ? (settingsDoc.data().odongPerComment ?? 5) : 5;

  await runTransaction(db, async (t) => {
    if (commentData.authorUid) {
      t.update(doc(db, 'users', commentData.authorUid), { odong: increment(odong) });
    }
    t.update(postRef, { commentCount: increment(1) });
    
    const newComment: any = {
      ...commentData,
      content: contentFilter.filteredText,
      postId: postDocId,
      likes: 0,
      dislikes: 0,
      createdAt: serverTimestamp(),
    };

    if (commentData.authorPassword) {
      const salt = generateSalt();
      newComment.authorSalt = salt;
      newComment.authorPassword = await hashPassword(commentData.authorPassword, salt);
    }

    // Firestore는 undefined를 허용하지 않으므로 제거
    Object.keys(newComment).forEach(key => {
      if (newComment[key] === undefined) {
        delete newComment[key];
      }
    });

    t.set(doc(commentsRef), newComment);
  });
};

export const deleteComment = async (postDocId: string, commentDocId: string) => {
  const postRef = doc(db, 'posts', postDocId);
  const commentRef = doc(postRef, 'comments', commentDocId);

  await runTransaction(db, async (t) => {
    // Delete the comment document
    t.delete(commentRef);
    // Decrement the comment count on the post
    t.update(postRef, { commentCount: increment(-1) });
  });
};

// ─── Ads ──────────────────────────────────────────────────
export const getActiveAds = async (): Promise<AdBanner[]> => {
  const q = query(
    collection(db, 'ads'),
    where('active', '==', true),
    limit(3)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdBanner));
};

export const updateUserNickname = async (uid: string, nickname: string) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { nickname });
};

// ─── Market ───────────────────────────────────────────────
export const purchaseStickerPack = async (uid: string, packId: string, price: number) => {
  const userRef = doc(db, 'users', uid);
  await runTransaction(db, async (t) => {
    const userDoc = await t.get(userRef);
    if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
    const userData = userDoc.data();
    if (userData.odong < price) {
      throw new Error('INSUFFICIENT_FUNDS');
    }
    const currentStickers = userData.purchasedStickers || [];
    if (currentStickers.includes(packId)) {
      throw new Error('ALREADY_PURCHASED');
    }
    t.update(userRef, {
      odong: increment(-price),
      purchasedStickers: arrayUnion(packId)
    });
  });
};

