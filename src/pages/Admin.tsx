import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useSettingsStore from '../store/useSettingsStore';
import { Settings, Image as ImageIcon, Users, MessageSquare, Shield, Plus, Trash2, ToggleLeft, ToggleRight, ShoppingBag, FileText, ChevronUp, ChevronDown, Edit2 } from 'lucide-react';
import {
  uploadFile, createAdBanner, getSiteSettings, updateSiteSettings,
  updateBoardSettings, getBoardSettings, getAdBanners,
  toggleAdBanner, deleteAdBanner,
  getProfanityList, updateProfanityList,
  createBoard, deleteBoard,
  getUsers, updateUserRole, toggleUserBan,
  getFooterDocuments, createFooterDocument, updateFooterDocument, deleteFooterDocument,
} from '../lib/adminApi';
import type { SiteSettings, BoardSettings, AdBanner, UserRecord, FooterDocument } from '../lib/adminApi';
import { clearBadWordsCache } from '../utils/filter';
import RichEditor from '../components/common/RichEditor';
import './Admin.css';

import { getBoards } from '../lib/api';
import type { Board } from '../lib/api';

// HomeWidget 타입 정의
interface HomeWidget {
  id: string;
  type: 'recent' | 'board' | 'market' | 'custom' | 'ranking';
  label: string;
  data?: string;     // boardId 등
  content?: string;  // custom HTML
}

const Admin: React.FC = () => {
  const { profile, loading: authLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'boards' | 'ads' | 'users' | 'settings' | 'profanity' | 'market' | 'pages'>('boards');
  const globalSettings = useSettingsStore();

  // ── Site Settings ─────────────────────────────────────
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    odongPerPost: 10, odongPerComment: 5, defaultAnonSuffix: '봉군',
    profanityAction: 'mask', likeName: '대봉황', dislikeName: '닭둘기',
    popularPostThreshold: 5, juksilThreshold: 10,
    popularBoardId: 'juksil',
    homeWidgets: [],
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  // ── Footer Documents (하단 문서) ────────────────────────
  const [footerDocList, setFooterDocList] = useState<FooterDocument[]>([]);
  const [editingDoc, setEditingDoc] = useState<FooterDocument | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocSlug, setNewDocSlug] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [docSubmitting, setDocSubmitting] = useState(false);

  // ── Home Widget Builder ────────────────────────────────
  const [homeWidgetList, setHomeWidgetList] = useState<HomeWidget[]>([]);
  const [newWidgetType, setNewWidgetType] = useState<HomeWidget['type']>('recent');
  const [newWidgetBoardId, setNewWidgetBoardId] = useState('');
  const [newWidgetCustomContent, setNewWidgetCustomContent] = useState('');
  const [newWidgetLabel, setNewWidgetLabel] = useState('');

  // ── Board Settings ────────────────────────────────────
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState('free');
  const [boardSettings, setBoardSettings] = useState<BoardSettings>({
    id: 'free', name: '', description: '', type: 'normal',
    allowComments: true, allowVotes: true, allowUserPost: true, allowUserComment: true,
    prefixes: [], headerInfo: '', footerInfo: '',
  });
  const [newPrefix, setNewPrefix] = useState('');
  const [boardSubmitting, setBoardSubmitting] = useState(false);
  const [newBoardId, setNewBoardId] = useState('');
  const [newBoardName, setNewBoardName] = useState('');

  // ── Ads ───────────────────────────────────────────────
  const [adTitle, setAdTitle] = useState('');
  const [adFile, setAdFile] = useState<File | null>(null);
  const [adLink, setAdLink] = useState('');
  const [adSubmitting, setAdSubmitting] = useState(false);
  const [adList, setAdList] = useState<AdBanner[]>([]);

  // ── Profanity ─────────────────────────────────────────
  const [profanityWords, setProfanityWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [profanitySubmitting, setProfanitySubmitting] = useState(false);

  // ── Market ────────────────────────────────────────────
  const [newMarketItemName, setNewMarketItemName] = useState('');
  const [newMarketItemPrice, setNewMarketItemPrice] = useState<number>(0);
  const [newMarketItemFiles, setNewMarketItemFiles] = useState<File[]>([]);
  const [marketSubmitting, setMarketSubmitting] = useState(false);

  // ── User Management ──────────────────────────────────────
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    getSiteSettings().then(s => {
      setSiteSettings(s);
      // homeWidgets 마이그레이션: string[] -> HomeWidget[]
      if (s.homeWidgets && s.homeWidgets.length > 0) {
        if (typeof s.homeWidgets[0] === 'string') {
          // 기존 string[] 포맷을 HomeWidget[]으로 변환
          const migrated: HomeWidget[] = (s.homeWidgets as any as string[]).map((w: string, i: number) => ({
            id: `migrated_${i}`,
            type: w === 'recent_posts' ? 'recent' : w === 'popular_board' ? 'board' : w === 'notice' ? 'recent' : 'recent' as HomeWidget['type'],
            label: w === 'recent_posts' ? '최신 글' : w === 'popular_board' ? '인기 게시판' : w === 'notice' ? '공지/광고 배너' : w,
            data: w === 'popular_board' ? (s.popularBoardId || 'juksil') : undefined,
          }));
          setHomeWidgetList(migrated);
        } else {
          setHomeWidgetList(s.homeWidgets as any as HomeWidget[]);
        }
      }
    }).catch(console.error);
    getAdBanners().then(setAdList).catch(console.error);
    getProfanityList().then(setProfanityWords).catch(console.error);
    getBoards().then(setBoards).catch(console.error);
    setUsersLoading(true);
    getUsers().then(setUserList).catch(console.error).finally(() => setUsersLoading(false));
    getFooterDocuments().then(setFooterDocList).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedBoardId) return;
    getBoardSettings(selectedBoardId).then(b => {
      if (b) {
        setBoardSettings(b);
      } else {
        const board = boards.find(bl => bl.id === selectedBoardId);
        setBoardSettings({
          id: selectedBoardId, name: board?.name || '', description: '', type: 'normal',
          allowComments: true, allowVotes: true, allowUserPost: true, allowUserComment: true,
          prefixes: [], headerInfo: '', footerInfo: '',
        });
      }
    }).catch(console.error);
  }, [selectedBoardId, boards]);

  // ── Handlers ─────────────────────────────────────────
  const handleBoardCreate = async () => {
    if (!newBoardId || !newBoardName) return alert('게시판 ID와 이름을 모두 입력해주세요.');
    if (!/^[a-zA-Z0-9_]+$/.test(newBoardId)) return alert('게시판 ID는 영문과 숫자, 밑줄(_)만 가능합니다.');
    
    try {
      await createBoard(newBoardId, newBoardName);
      setNewBoardId('');
      setNewBoardName('');
      const updatedBoards = await getBoards();
      setBoards(updatedBoards);
      setSelectedBoardId(newBoardId);
      alert('새 게시판이 추가되었습니다.');
    } catch (e) {
      console.error(e);
      alert('게시판 생성 실패');
    }
  };

  const handleBoardDelete = async () => {
    if (boards.length <= 1) return alert('게시판은 최소 1개 이상 존재해야 합니다.');
    if (!confirm(`정말로 '${boardSettings.name}' 게시판을 삭제하시겠습니까?\n(경고: 이 작업은 되돌릴 수 없으며, 기존 게시글이 고립될 수 있습니다)`)) return;
    try {
      await deleteBoard(selectedBoardId);
      const updatedBoards = await getBoards();
      setBoards(updatedBoards);
      setSelectedBoardId(updatedBoards[0]?.id || '');
      alert('게시판이 삭제되었습니다.');
    } catch (e) {
      console.error(e);
      alert('게시판 삭제 실패');
    }
  };

  // ── Widget Builder Helpers ──────────────────────────────
  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const arr = [...homeWidgetList];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= arr.length) return;
    [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]];
    setHomeWidgetList(arr);
  };
  const removeWidget = (index: number) => {
    setHomeWidgetList(prev => prev.filter((_, i) => i !== index));
  };
  const addWidget = () => {
    const label = newWidgetLabel || (newWidgetType === 'recent' ? '최신 글' : newWidgetType === 'board' ? '게시판' : newWidgetType === 'market' ? '딱지 마켓' : newWidgetType === 'ranking' ? '붐비는 게시판' : '커스텀 요소');
    const widget: HomeWidget = {
      id: `widget_${Date.now()}`,
      type: newWidgetType,
      label,
      data: newWidgetType === 'board' ? newWidgetBoardId : undefined,
      content: newWidgetType === 'custom' ? newWidgetCustomContent : undefined,
    };
    setHomeWidgetList(prev => [...prev, widget]);
    setNewWidgetLabel('');
    setNewWidgetCustomContent('');
    setNewWidgetBoardId('');
  };

  // ── Favicon Aspect Ratio Check ──────────────────────────
  const checkSquareImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(Math.abs(img.width / img.height - 1) < 0.05); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      img.src = url;
    });
  };

  const handleSettingsSave = async () => {
    setSettingsSubmitting(true);
    try {
      let logoUrl: string | undefined;
      let faviconUrl: string | undefined;
      if (logoFile) logoUrl = await uploadFile(logoFile, 'logos');
      if (faviconFile) {
        const validExts = ['.png', '.ico', '.svg', '.jpg', '.jpeg', '.webp'];
        const ext = '.' + faviconFile.name.split('.').pop()?.toLowerCase();
        if (!validExts.includes(ext)) {
          setSettingsSubmitting(false);
          return alert('파비콘은 PNG, ICO, SVG, JPG 형식만 가능합니다.');
        }
        const isSquare = await checkSquareImage(faviconFile);
        if (!isSquare) {
          setSettingsSubmitting(false);
          return alert('파비콘 이미지는 1:1 비율이어야 합니다.');
        }
        faviconUrl = await uploadFile(faviconFile, 'favicon');
      }
      const saveData = {
        ...siteSettings,
        ...(logoUrl ? { logoUrl } : {}),
        ...(faviconUrl ? { faviconUrl } : {}),
        homeWidgets: homeWidgetList as any,
      };
      await updateSiteSettings(saveData);
      // Zustand 글로벌 스토어 즉시 동기화
      globalSettings.updateSettingsLocal({
        ...saveData,
        ...(logoUrl ? { logoUrl } : {}),
        ...(faviconUrl ? { faviconUrl } : {}),
      });
      alert('사이트 설정이 저장되었습니다.');
    } catch (e: any) { console.error(e); alert(`저장 실패: ${e?.message || e}`); }
    finally { setSettingsSubmitting(false); }
  };

  // ── Footer Document Handlers ─────────────────────────────
  const handleDocSave = async () => {
    if (editingDoc) {
      // 수정 모드
      if (!editingDoc.id) return;
      setDocSubmitting(true);
      try {
        await updateFooterDocument(editingDoc.id, {
          title: editingDoc.title,
          slug: editingDoc.slug,
          content: editingDoc.content,
          order: editingDoc.order,
        });
        setEditingDoc(null);
        const updated = await getFooterDocuments();
        setFooterDocList(updated);
        globalSettings.setFooterDocs(updated);
        alert('문서가 수정되었습니다.');
      } catch (e: any) { console.error(e); alert(`수정 실패: ${e?.message || e}`); }
      finally { setDocSubmitting(false); }
    } else {
      // 신규 등록
      if (!newDocTitle || !newDocSlug) return alert('제목과 슬러그(URL 키)를 모두 입력해주세요.');
      if (!/^[a-zA-Z0-9_-]+$/.test(newDocSlug)) return alert('슬러그는 영문, 숫자, 하이픈, 밑줄만 가능합니다.');
      setDocSubmitting(true);
      try {
        await createFooterDocument({
          title: newDocTitle,
          slug: newDocSlug,
          content: newDocContent,
          order: footerDocList.length,
        });
        setNewDocTitle(''); setNewDocSlug(''); setNewDocContent('');
        const updated = await getFooterDocuments();
        setFooterDocList(updated);
        globalSettings.setFooterDocs(updated);
        alert('문서가 등록되었습니다.');
      } catch (e: any) { console.error(e); alert(`등록 실패: ${e?.message || e}`); }
      finally { setDocSubmitting(false); }
    }
  };

  const handleDocDelete = async (docId: string) => {
    if (!confirm('정말로 이 문서를 삭제하시겠습니까?')) return;
    try {
      await deleteFooterDocument(docId);
      const updated = await getFooterDocuments();
      setFooterDocList(updated);
      globalSettings.setFooterDocs(updated);
    } catch (e: any) { console.error(e); alert(`삭제 실패: ${e?.message || e}`); }
  };

  const handleBoardSave = async () => {
    setBoardSubmitting(true);
    try {
      await updateBoardSettings(selectedBoardId, boardSettings);
      alert('게시판 설정이 저장되었습니다.');
    } catch (e: any) { console.error(e); alert(`저장 실패: ${e?.message || e}`); }
    finally { setBoardSubmitting(false); }
  };

  const checkImageAspectRatio = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const ratio = img.width / img.height;
        resolve(ratio >= 0.95 && ratio <= 1.05); // 1:1 오차 허용 범위
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };
      img.src = objectUrl;
    });
  };

  const handleMarketItemSubmit = async () => {
    if (!newMarketItemName || newMarketItemFiles.length === 0 || newMarketItemPrice <= 0) {
      return alert('이름, 가격, 이미지를 모두 입력해주세요.');
    }
    if (newMarketItemFiles.length > 20) {
      return alert('한 번에 최대 20개까지만 업로드 가능합니다.');
    }

    setMarketSubmitting(true);
    try {
      for (const file of newMarketItemFiles) {
        const isSquare = await checkImageAspectRatio(file);
        if (!isSquare) {
          setMarketSubmitting(false);
          return alert(`'${file.name}' 이미지의 비율이 1:1이 아닙니다. 정방형 이미지만 업로드해주세요.`);
        }
      }

      const imageUrls = [];
      for (const file of newMarketItemFiles) {
        const url = await uploadFile(file, 'market');
        imageUrls.push(url);
      }
      
      const newItem = {
        id: Date.now().toString(),
        name: newMarketItemName,
        price: newMarketItemPrice,
        imageUrls
      };
      
      const updatedItems = [...(siteSettings.marketItems || []), newItem];
      await updateSiteSettings({ ...siteSettings, marketItems: updatedItems });
      setSiteSettings(prev => ({ ...prev, marketItems: updatedItems }));
      
      setNewMarketItemName('');
      setNewMarketItemPrice(0);
      setNewMarketItemFiles([]);
      alert(`딱지 팩 '${newMarketItemName}' (${newMarketItemFiles.length}종)이(가) 등록되었습니다!`);
    } catch (e: any) {
      console.error(e);
      alert(`상품 등록 실패: ${e?.message || e}`);
    } finally {
      setMarketSubmitting(false);
    }
  };

  const handleMarketItemDelete = async (itemId: string) => {
    if (!confirm('상품을 삭제하시겠습니까?')) return;
    try {
      const newItems = (siteSettings.marketItems || []).filter(item => item.id !== itemId);
      await updateSiteSettings({ ...siteSettings, marketItems: newItems });
      setSiteSettings(prev => ({ ...prev, marketItems: newItems }));
    } catch (e: any) {
      console.error(e);
      alert(`삭제 실패: ${e?.message || e}`);
    }
  };

  const handleAdSubmit = async () => {
    if (!adTitle || !adFile) return alert('제목과 이미지를 모두 첨부해주세요.');
    setAdSubmitting(true);
    try {
      const imageUrl = await uploadFile(adFile, 'ads');
      await createAdBanner({ title: adTitle, imageUrl, linkUrl: adLink });
      alert('광고가 등록되었습니다!');
      setAdTitle(''); setAdFile(null); setAdLink('');
      const updated = await getAdBanners();
      setAdList(updated);
    } catch (e: any) { console.error(e); alert(`광고 등록 실패: ${e?.message || e}`); }
    finally { setAdSubmitting(false); }
  };

  const handleAdToggle = async (ad: AdBanner) => {
    if (!ad.id) return;
    await toggleAdBanner(ad.id, !ad.active);
    setAdList(prev => prev.map(a => a.id === ad.id ? { ...a, active: !a.active } : a));
  };

  const handleAdDelete = async (adId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await deleteAdBanner(adId);
    setAdList(prev => prev.filter(a => a.id !== adId));
  };

  const handleProfanitySave = async () => {
    setProfanitySubmitting(true);
    try {
      const cleaned = profanityWords.map(w => w.trim()).filter(Boolean);
      await updateProfanityList(cleaned);
      clearBadWordsCache();
      alert('금칙어 목록이 저장되었습니다.');
    } catch (e: any) { console.error(e); alert(`저장 실패: ${e?.message || e}`); }
    finally { setProfanitySubmitting(false); }
  };

  const addPrefix = () => {
    if (!newPrefix.trim()) return;
    setBoardSettings(prev => ({ ...prev, prefixes: [...(prev.prefixes || []), newPrefix.trim()] }));
    setNewPrefix('');
  };
  const removePrefix = (p: string) => {
    setBoardSettings(prev => ({ ...prev, prefixes: (prev.prefixes || []).filter(x => x !== p) }));
  };
  const addWord = () => {
    if (!newWord.trim()) return;
    setProfanityWords(prev => [...prev, newWord.trim()]);
    setNewWord('');
  };
  const removeWord = (w: string) => setProfanityWords(prev => prev.filter(x => x !== w));

  if (authLoading) return <div className="admin-container glass-panel"><p style={{ textAlign: 'center' }}>권한을 확인하는 중입니다...</p></div>;
  if (!profile || profile.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="admin-container glass-panel">
      <h1 className="page-title">관리자 대시보드</h1>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          {[
            { key: 'boards', icon: <MessageSquare size={18} />, label: '게시판 관리' },
            { key: 'market', icon: <ShoppingBag size={18} />, label: '딱지 마켓 설정' },
            { key: 'ads', icon: <ImageIcon size={18} />, label: '자체 광고 관리' },
            { key: 'profanity', icon: <Shield size={18} />, label: '금칙어 관리' },
            { key: 'users', icon: <Users size={18} />, label: '회원 관리' },
            { key: 'pages', icon: <FileText size={18} />, label: '하단 문서 관리' },
            { key: 'settings', icon: <Settings size={18} />, label: '사이트 설정' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </aside>

        <main className="admin-content">

          {/* ─── 게시판 관리 ─────────────────────────────── */}
          {activeTab === 'boards' && (
            <section className="admin-section">
              <h2>게시판 관리</h2>
              <p className="admin-desc">게시판별 이름, 공지, 권한, 말머리를 설정합니다.</p>

              <div className="admin-card">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>새 게시판 추가 (ID)</label>
                    <input type="text" className="form-input" value={newBoardId} onChange={e => setNewBoardId(e.target.value)} placeholder="예: humor" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>새 게시판 이름</label>
                    <input type="text" className="form-input" value={newBoardName} onChange={e => setNewBoardName(e.target.value)} placeholder="예: 유머게시판" />
                  </div>
                  <button onClick={handleBoardCreate} className="btn btn-primary" style={{ marginBottom: '4px' }}>
                    <Plus size={18} /> 추가
                  </button>
                </div>
              </div>

              <div className="admin-card">
                <div className="form-group">
                  <label>게시판 선택</label>
                  <select className="form-input" value={selectedBoardId} onChange={e => setSelectedBoardId(e.target.value)}>
                    {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>게시판 이름</label>
                  <input type="text" className="form-input" value={boardSettings.name}
                    onChange={e => setBoardSettings(prev => ({ ...prev, name: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>상단 공지</label>
                  <RichEditor
                    value={boardSettings.headerInfo || ''}
                    onChange={val => setBoardSettings(prev => ({ ...prev, headerInfo: val }))}
                    minHeight="150px"
                    placeholder="상단 공지 내용을 입력하세요..."
                  />
                </div>

                <div className="form-group">
                  <label>하단 공지</label>
                  <RichEditor
                    value={boardSettings.footerInfo || ''}
                    onChange={val => setBoardSettings(prev => ({ ...prev, footerInfo: val }))}
                    minHeight="150px"
                    placeholder="하단 공지 내용을 입력하세요..."
                  />
                </div>

                <div className="settings-toggles">
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>권한 설정</h4>
                  {([
                    { key: 'allowUserPost', label: '일반 사용자 글 작성 허용' },
                    { key: 'allowUserComment', label: '일반 사용자 댓글 작성 허용' },
                    { key: 'allowComments', label: '댓글 기능 활성화' },
                    { key: 'allowVotes', label: '좋아요/싫어요 기능 활성화' },
                  ] as { key: keyof BoardSettings; label: string }[]).map(({ key, label }) => (
                    <div key={key} className="toggle-row">
                      <span>{label}</span>
                      <button
                        type="button"
                        className={`toggle-btn ${boardSettings[key] ? 'on' : 'off'}`}
                        onClick={() => setBoardSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                      >
                        {boardSettings[key]
                          ? <><ToggleRight size={20} /> ON</>
                          : <><ToggleLeft size={20} /> OFF</>}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label>말머리 목록</label>
                  <div className="prefix-list">
                    {(boardSettings.prefixes || []).map(p => (
                      <span key={p} className="prefix-tag">
                        {p}
                        <button type="button" className="prefix-remove" onClick={() => removePrefix(p)}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className="prefix-add-row">
                    <input type="text" className="form-input" value={newPrefix}
                      onChange={e => setNewPrefix(e.target.value)}
                      placeholder="예: [질문], [정보], [잡담] (각각 입력 후 추가)"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPrefix())}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addPrefix}>
                      <Plus size={16} /> 추가
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button onClick={handleBoardSave} disabled={boardSubmitting} className="btn btn-primary" style={{ flex: 1 }}>
                    {boardSubmitting ? '저장 중...' : '게시판 설정 저장'}
                  </button>
                  <button onClick={handleBoardDelete} className="btn btn-danger" style={{ padding: '0 2rem' }}>
                    <Trash2 size={18} /> 삭제
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ─── 딱지 마켓 관리 ───────────────────────────── */}
          {activeTab === 'market' && (
            <section className="admin-section">
              <h2>딱지 마켓 설정</h2>
              <p className="admin-desc">마켓 이름과 판매 상품을 관리합니다.</p>

              <div className="admin-card">
                <div className="form-group" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label>마켓 이름</label>
                    <input type="text" className="form-input" value={siteSettings.marketName || '딱지 마켓'}
                      onChange={e => setSiteSettings(prev => ({ ...prev, marketName: e.target.value }))}
                    />
                  </div>
                  <button onClick={handleSettingsSave} disabled={settingsSubmitting} className="btn btn-primary" style={{ marginBottom: '4px' }}>
                    {settingsSubmitting ? '저장 중...' : '이름 저장'}
                  </button>
                </div>
              </div>

              <div className="admin-card" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>새 상품 등록</h4>
                <div className="form-group">
                  <label>상품 이름</label>
                  <input type="text" className="form-input" value={newMarketItemName}
                    onChange={e => setNewMarketItemName(e.target.value)} placeholder="예: 딱지 스킨 (봉군)" />
                </div>
                <div className="form-group">
                  <label>상품 이미지 업로드 (최대 20개, 가급적 1:1 비율)</label>
                  <input type="file" className="form-input" accept="image/*" multiple
                    onChange={e => {
                      if (e.target.files) {
                        setNewMarketItemFiles(Array.from(e.target.files));
                      }
                    }} />
                  {newMarketItemFiles.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginTop: '0.5rem' }}>
                      선택된 파일: {newMarketItemFiles.length}개
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label>가격 (오동)</label>
                  <input type="number" className="form-input" value={newMarketItemPrice || ''}
                    onChange={e => setNewMarketItemPrice(Number(e.target.value))} placeholder="예: 500" />
                </div>
                <button onClick={handleMarketItemSubmit} disabled={marketSubmitting} className="btn btn-primary">
                  {marketSubmitting ? '등록 중...' : '상품 등록'}
                </button>
              </div>

              <div className="admin-card" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>등록된 상품 목록</h4>
                {(!siteSettings.marketItems || siteSettings.marketItems.length === 0) ? (
                  <p style={{ color: 'var(--color-text-secondary)' }}>등록된 상품이 없습니다.</p>
                ) : (
                  <div className="ad-list">
                    {siteSettings.marketItems.map(item => (
                      <div key={item.id} className="ad-item">
                        <img src={item.imageUrls ? item.imageUrls[0] : item.imageUrl} alt={item.name} className="ad-thumb" style={{ objectFit: 'contain' }} />
                        <div className="ad-info">
                          <span className="ad-title">{item.name} {item.imageUrls && item.imageUrls.length > 1 ? `(${item.imageUrls.length}종)` : ''}</span>
                          <span className="ad-url" style={{ color: 'var(--color-primary)' }}>{item.price} 오동</span>
                        </div>
                        <div className="ad-actions">
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleMarketItemDelete(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ─── 자체 광고 관리 ───────────────────────────── */}
          {activeTab === 'ads' && (
            <section className="admin-section">
              <h2>자체 광고 관리</h2>
              <p className="admin-desc">광고 배너를 업로드하고 활성/비활성 관리합니다. 권장 비율: 가로형 1200×250px</p>

              <div className="admin-card">
                <h4 style={{ marginBottom: '1rem' }}>새 광고 등록</h4>
                <div className="form-group">
                  <label>광고 제목</label>
                  <input type="text" className="form-input" value={adTitle}
                    onChange={e => setAdTitle(e.target.value)} placeholder="예: 딱지 스토어 오픈 이벤트" />
                </div>
                <div className="form-group">
                  <label>배너 이미지 업로드 (권장: 1200×250px)</label>
                  <input type="file" className="form-input" accept="image/*"
                    onChange={e => setAdFile(e.target.files?.[0] || null)} />
                </div>
                <div className="form-group">
                  <label>클릭 시 이동 URL (없으면 빈칸)</label>
                  <input type="text" className="form-input" value={adLink}
                    onChange={e => setAdLink(e.target.value)} placeholder="https://..." />
                </div>
                <button onClick={handleAdSubmit} disabled={adSubmitting} className="btn btn-primary">
                  {adSubmitting ? '업로드 중...' : '광고 등록'}
                </button>
              </div>

              <div className="admin-card" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>등록된 광고 목록</h4>
                {adList.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)' }}>등록된 광고가 없습니다.</p>
                ) : (
                  <div className="ad-list">
                    {adList.map(ad => (
                      <div key={ad.id} className="ad-item">
                        <img src={ad.imageUrl} alt={ad.title} className="ad-thumb" />
                        <div className="ad-info">
                          <span className="ad-title">{ad.title}</span>
                          {ad.linkUrl && <span className="ad-url">{ad.linkUrl}</span>}
                        </div>
                        <div className="ad-actions">
                          <button
                            className={`toggle-btn ${ad.active ? 'on' : 'off'} btn-sm`}
                            onClick={() => handleAdToggle(ad)}
                          >
                            {ad.active ? <><ToggleRight size={16} /> 활성</> : <><ToggleLeft size={16} /> 비활성</>}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => ad.id && handleAdDelete(ad.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ─── 금칙어 관리 ──────────────────────────────── */}
          {activeTab === 'profanity' && (
            <section className="admin-section">
              <h2>금칙어 관리</h2>
              <p className="admin-desc">게시글 및 댓글에 적용되는 금칙어를 관리합니다. 욕설 필터링 동작(복자/차단)은 사이트 설정에서 변경할 수 있습니다.</p>

              <div className="admin-card">
                <div className="profanity-add-row">
                  <input type="text" className="form-input" value={newWord}
                    onChange={e => setNewWord(e.target.value)}
                    placeholder="추가할 금칙어 입력"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addWord())}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={addWord}>
                    <Plus size={16} /> 추가
                  </button>
                </div>

                <div className="profanity-tags" style={{ marginTop: '1rem' }}>
                  {profanityWords.map(w => (
                    <span key={w} className="prefix-tag">
                      {w}
                      <button type="button" className="prefix-remove" onClick={() => removeWord(w)}>×</button>
                    </span>
                  ))}
                </div>

                <button onClick={handleProfanitySave} disabled={profanitySubmitting} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                  {profanitySubmitting ? '저장 중...' : '금칙어 목록 저장'}
                </button>
              </div>
            </section>
          )}

          {/* ─── 회원 및 관리자 계정 관리 ─────────────── */}
          {activeTab === 'users' && (
            <section className="admin-section">
              <h2>회원 및 관리자 계정 관리</h2>
              <p className="admin-desc">회원 역할(admin/user)을 변경하거나 차단할 수 있습니다.</p>

              <div className="admin-card">
                {usersLoading ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>회원 목록 로딩 중...</p>
                ) : userList.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>등록된 회원이 없습니다.</p>
                ) : (
                  <div className="user-table-wrapper" style={{ overflowX: 'auto' }}>
                    <table className="user-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem 0.5rem' }}>닉네임</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>이메일</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>오동</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>역할</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>상태</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userList.map(u => (
                          <tr key={u.uid} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{u.nickname}</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{u.email || '-'}</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>{u.odong}</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.6rem',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: u.role === 'admin' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.1)',
                                color: u.role === 'admin' ? '#ef4444' : 'var(--color-text-muted)'
                              }}>
                                {u.role === 'admin' ? '관리자' : '일반'}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {u.isBanned
                                ? <span style={{ color: '#ef4444', fontWeight: 600 }}>차단됨</span>
                                : <span style={{ color: 'var(--color-success)' }}>정상</span>
                              }
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <button
                                  className="btn-sm"
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(100,116,139,0.05)',
                                    color: 'var(--color-text-muted)',
                                    cursor: 'pointer'
                                  }}
                                  onClick={async () => {
                                    const newRole = u.role === 'admin' ? 'user' : 'admin';
                                    if (!confirm(`${u.nickname}님의 역할을 '${newRole === 'admin' ? '관리자' : '일반'}'으로 변경하시겠습니까?`)) return;
                                    try {
                                      await updateUserRole(u.uid, newRole);
                                      setUserList(prev => prev.map(x => x.uid === u.uid ? { ...x, role: newRole } : x));
                                    } catch (e: any) { console.error(e); alert(`변경 실패: ${e?.message || e}`); }
                                  }}
                                >
                                  {u.role === 'admin' ? '일반으로' : '관리자로'}
                                </button>
                                <button
                                  className="btn-sm"
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    border: `1px solid ${u.isBanned ? 'var(--color-success)' : '#ef4444'}`,
                                    borderRadius: 'var(--radius-sm)',
                                    background: u.isBanned ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                    color: u.isBanned ? 'var(--color-success)' : '#ef4444',
                                    cursor: 'pointer'
                                  }}
                                  onClick={async () => {
                                    const action = u.isBanned ? '차단 해제' : '차단';
                                    if (!confirm(`${u.nickname}님을 ${action}하시겠습니까?`)) return;
                                    try {
                                      await toggleUserBan(u.uid, !u.isBanned);
                                      setUserList(prev => prev.map(x => x.uid === u.uid ? { ...x, isBanned: !u.isBanned } : x));
                                    } catch (e: any) { console.error(e); alert(`처리 실패: ${e?.message || e}`); }
                                  }}
                                >
                                  {u.isBanned ? '차단해제' : '차단'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ─── 하단 문서 관리 ─────────────────────────────── */}
          {activeTab === 'pages' && (
            <section className="admin-section">
              <h2>하단 문서 관리</h2>
              <p className="admin-desc">이용약관, FAQ, 개인정보 처리방침 등 페이지 하단에 링크될 문서를 자유롭게 추가/수정/삭제합니다.</p>

              <div className="admin-card">
                <h4 style={{ marginBottom: '1rem' }}>{editingDoc ? '문서 수정' : '새 문서 등록'}</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>문서 제목</label>
                    <input type="text" className="form-input"
                      value={editingDoc ? editingDoc.title : newDocTitle}
                      onChange={e => editingDoc ? setEditingDoc({ ...editingDoc, title: e.target.value }) : setNewDocTitle(e.target.value)}
                      placeholder="예: 이용약관" />
                  </div>
                  <div className="form-group">
                    <label>슬러그 (URL 키)</label>
                    <input type="text" className="form-input"
                      value={editingDoc ? editingDoc.slug : newDocSlug}
                      onChange={e => editingDoc ? setEditingDoc({ ...editingDoc, slug: e.target.value }) : setNewDocSlug(e.target.value)}
                      placeholder="예: terms, faq, privacy" />
                    <small style={{ color: 'var(--color-text-muted)' }}>접속 URL: /page/{editingDoc ? editingDoc.slug : newDocSlug || 'slug'}</small>
                  </div>
                </div>
                <div className="form-group">
                  <label>내용</label>
                  <RichEditor
                    value={editingDoc ? editingDoc.content : newDocContent}
                    onChange={val => editingDoc ? setEditingDoc({ ...editingDoc, content: val }) : setNewDocContent(val)}
                    minHeight="250px"
                    placeholder="문서 내용을 입력하세요..."
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleDocSave} disabled={docSubmitting} className="btn btn-primary">
                    {docSubmitting ? '저장 중...' : (editingDoc ? '수정 저장' : '문서 등록')}
                  </button>
                  {editingDoc && (
                    <button className="btn btn-secondary" onClick={() => setEditingDoc(null)}>취소</button>
                  )}
                </div>
              </div>

              <div className="admin-card" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>등록된 문서 목록</h4>
                {footerDocList.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)' }}>등록된 문서가 없습니다.</p>
                ) : (
                  <div className="ad-list">
                    {footerDocList.map(d => (
                      <div key={d.id} className="ad-item">
                        <div className="ad-info" style={{ flex: 1 }}>
                          <span className="ad-title">{d.title}</span>
                          <span className="ad-url">/page/{d.slug}</span>
                        </div>
                        <div className="ad-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingDoc(d)}>
                            <Edit2 size={14} /> 수정
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => d.id && handleDocDelete(d.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ─── 사이트 설정 ─────────────────────────────── */}
          {activeTab === 'settings' && (
            <section className="admin-section">
              <h2>사이트 기본 설정</h2>

              <div className="admin-card">
                <div className="form-group">
                  <label>사이트 제목 (브라우저 탭에 표시)</label>
                  <input type="text" className="form-input" value={siteSettings.siteTitle || ''}
                    onChange={e => setSiteSettings(prev => ({ ...prev, siteTitle: e.target.value }))}
                    placeholder="예: 봉황스페이스" />
                </div>

                <div className="form-group">
                  <label>상단 로고 이미지 업로드 (업로드 시 텍스트 대체)</label>
                  {siteSettings.logoUrl && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <img src={siteSettings.logoUrl} alt="현재 로고" style={{ maxHeight: '40px', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>현재 로고</span>
                    </div>
                  )}
                  <input type="file" className="form-input" accept="image/*"
                    onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                </div>

                <div className="form-group">
                  <label>파비콘 이미지 업로드 (1:1 비율, PNG/ICO/SVG)</label>
                  {siteSettings.faviconUrl && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <img src={siteSettings.faviconUrl} alt="현재 파비콘" style={{ width: '32px', height: '32px', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>현재 파비콘</span>
                    </div>
                  )}
                  <input type="file" className="form-input" accept=".png,.ico,.svg,.jpg,.jpeg,.webp"
                    onChange={e => setFaviconFile(e.target.files?.[0] || null)} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>게시글 작성 시 오동 보상</label>
                    <input type="number" className="form-input" value={siteSettings.odongPerPost}
                      onChange={e => setSiteSettings(prev => ({ ...prev, odongPerPost: Number(e.target.value) }))} />
                  </div>
                  <div className="form-group">
                    <label>댓글 작성 시 오동 보상</label>
                    <input type="number" className="form-input" value={siteSettings.odongPerComment}
                      onChange={e => setSiteSettings(prev => ({ ...prev, odongPerComment: Number(e.target.value) }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>익명 댓글 기본 접미사</label>
                  <input type="text" className="form-input" value={siteSettings.defaultAnonSuffix}
                    onChange={e => setSiteSettings(prev => ({ ...prev, defaultAnonSuffix: e.target.value }))} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>게시판 내 인기글 기준 (대봉황 수)</label>
                    <input type="number" className="form-input" value={siteSettings.popularPostThreshold}
                      onChange={e => setSiteSettings(prev => ({ ...prev, popularPostThreshold: Number(e.target.value) }))} />
                  </div>
                  <div className="form-group">
                    <label>죽실(인기게시판) 진입 기준 (대봉황 수)</label>
                    <input type="number" className="form-input" value={siteSettings.juksilThreshold}
                      onChange={e => setSiteSettings(prev => ({ ...prev, juksilThreshold: Number(e.target.value) }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>욕설 필터링 동작</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="radio" name="profanity" value="mask"
                        checked={siteSettings.profanityAction === 'mask'}
                        onChange={() => setSiteSettings(prev => ({ ...prev, profanityAction: 'mask' }))} />
                      복자 처리 (○표)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="radio" name="profanity" value="block"
                        checked={siteSettings.profanityAction === 'block'}
                        onChange={() => setSiteSettings(prev => ({ ...prev, profanityAction: 'block' }))} />
                      작성 차단
                    </label>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>추천(좋아요) 버튼 이름</label>
                    <input type="text" className="form-input" value={siteSettings.likeName}
                      onChange={e => setSiteSettings(prev => ({ ...prev, likeName: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>비추천(싫어요) 버튼 이름</label>
                    <input type="text" className="form-input" value={siteSettings.dislikeName}
                      onChange={e => setSiteSettings(prev => ({ ...prev, dislikeName: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                  <label>인기게시판(전당) 지정</label>
                  <p className="admin-desc" style={{ marginBottom: '0.5rem' }}>메인 화면이나 상단에 노출되는 가장 인기있는 게시판을 지정합니다. (기본: 죽실)</p>
                  <select className="form-input" value={siteSettings.popularBoardId || 'juksil'} onChange={e => setSiteSettings(prev => ({ ...prev, popularBoardId: e.target.value }))}>
                    {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                {/* ── 메인 화면 위젯 빌더 ── */}
                <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                  <label>메인 화면 (홈) 구성 설정</label>
                  <p className="admin-desc" style={{ marginBottom: '0.5rem' }}>요소를 추가하고 순서를 조정하세요. 위/아래 화살표로 순서를 변경할 수 있습니다.</p>

                  {/* 현재 위젯 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {homeWidgetList.length === 0 && (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', padding: '1rem', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>위젯이 없습니다. 아래에서 추가하세요.</p>
                    )}
                    {homeWidgetList.map((w, idx) => (
                      <div key={w.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)', background: 'rgba(100,116,139,0.04)'
                      }}>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>
                          {w.label}
                          <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                            ({w.type === 'recent' ? '최신 글' : w.type === 'board' ? `게시판: ${w.data || ''}` : w.type === 'market' ? '딱지 마켓' : w.type === 'ranking' ? '게시판 순위' : '커스텀'})
                          </span>
                        </span>
                        <button className="btn-sm" style={{ padding: '0.15rem 0.4rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }} onClick={() => moveWidget(idx, 'up')} disabled={idx === 0}><ChevronUp size={14} /></button>
                        <button className="btn-sm" style={{ padding: '0.15rem 0.4rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }} onClick={() => moveWidget(idx, 'down')} disabled={idx === homeWidgetList.length - 1}><ChevronDown size={14} /></button>
                        <button className="btn btn-danger btn-sm" style={{ padding: '0.15rem 0.4rem' }} onClick={() => removeWidget(idx)}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>

                  {/* 위젯 추가 UI */}
                  <div style={{ padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'rgba(100,116,139,0.02)' }}>
                    <h5 style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>위젯 추가</h5>
                    <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>타입</label>
                        <select className="form-input" value={newWidgetType} onChange={e => setNewWidgetType(e.target.value as HomeWidget['type'])}>
                          <option value="recent">최신 글</option>
                          <option value="board">특정 게시판</option>
                          <option value="ranking">붐비는 게시판 (순위)</option>
                          <option value="market">딱지 마켓</option>
                          <option value="custom">커스텀 (에디터)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>표시 이름</label>
                        <input type="text" className="form-input" value={newWidgetLabel}
                          onChange={e => setNewWidgetLabel(e.target.value)}
                          placeholder="예: 자유게시판 인기글" />
                      </div>
                    </div>
                    {newWidgetType === 'board' && (
                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                        <label>게시판 선택</label>
                        <select className="form-input" value={newWidgetBoardId} onChange={e => setNewWidgetBoardId(e.target.value)}>
                          <option value="">-- 선택 --</option>
                          {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                    )}
                    {newWidgetType === 'custom' && (
                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                        <label>커스텀 내용 (HTML)</label>
                        <RichEditor
                          value={newWidgetCustomContent}
                          onChange={setNewWidgetCustomContent}
                          minHeight="150px"
                          placeholder="메인 화면에 표시할 커스텀 내용을 입력하세요..."
                        />
                      </div>
                    )}
                    <button className="btn btn-secondary" onClick={addWidget}><Plus size={16} /> 위젯 추가</button>
                  </div>
                </div>

                <button onClick={handleSettingsSave} disabled={settingsSubmitting} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  {settingsSubmitting ? '저장 중...' : '설정 저장'}
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default Admin;
