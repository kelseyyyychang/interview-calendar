import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, updateDoc, doc 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, Plus, X, Upload, AlertCircle, Sparkles, Loader2, Check, 
  RotateCcw, Video, FileText, FileEdit, BarChart3, Building2, Layers, ChevronDown, 
  Clock, CheckCircle2, CalendarDays
} from 'lucide-react';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const getLocalDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addOneHour = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return '11:00';
  const [h, m] = timeStr.split(':').map(Number);
  const newH = (h + 1) % 24;
  return `${String(newH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
};

const getStageColor = (stage) => {
  if (stage?.includes('HR')) return 'bg-violet-50 text-violet-700 border-violet-200/60';
  if (stage?.includes('二面')) return 'bg-sky-50 text-sky-700 border-sky-200/60';
  if (stage?.includes('三面') || stage?.includes('最終')) return 'bg-amber-50 text-amber-700 border-amber-200/60';
  return 'bg-teal-50 text-teal-700 border-teal-200/60';
};

export default function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [collisionWarning, setCollisionWarning] = useState(false);

  const [activeTab, setActiveTab] = useState('upcoming');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const companyInputRef = useRef(null);

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordEvent, setRecordEvent] = useState(null);
  const [notesText, setNotesText] = useState('');

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showCompanyListInSummary, setShowCompanyListInSummary] = useState(false);

  const [rangeStartOffset, setRangeStartOffset] = useState(-1);
  const [rangeEndOffset, setRangeEndOffset] = useState(3);
  const scrollRef = useRef(null);

  const [isParsingAI, setIsParsingAI] = useState(false);
  const [parsedImageResult, setParsedImageResult] = useState(null);

  const csvInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [formData, setFormData] = useState({
    company: '',
    date: getLocalDateStr(new Date()),
    startTime: '10:00',
    endTime: '11:00',
    stage: '一面',
    type: '線上',
    status: 'confirmed',
    notes: ''
  });

  const resetForm = () => {
    setFormData({
      company: '',
      date: getLocalDateStr(new Date()),
      startTime: '10:00',
      endTime: '11:00',
      stage: '一面',
      type: '線上',
      status: 'confirmed',
      notes: ''
    });
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const eventsRef = collection(db, 'users', user.uid, 'events');
    const unsubscribe = onSnapshot(
      eventsRef,
      (snapshot) => {
        setEvents(
          snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        );
      },
      (error) => {
        console.error('Firestore 讀取失敗:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (companyInputRef.current && !companyInputRef.current.contains(e.target)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const summaryStats = useMemo(() => {
    const totalInterviews = events.length;
    const companyMap = new Map();
    const stageCounts = {};

    events.forEach(ev => {
      const cleanCompany = ev.company?.trim().toLowerCase();
      if (cleanCompany) {
        if (!companyMap.has(cleanCompany)) {
          companyMap.set(cleanCompany, ev.company.trim());
        }
      }
      const st = ev.stage || '一面';
      stageCounts[st] = (stageCounts[st] || 0) + 1;
    });

    return {
      totalInterviews,
      totalCompanies: companyMap.size,
      uniqueCompaniesList: Array.from(companyMap.values()),
      stageCounts
    };
  }, [events]);

  const todayStr = getLocalDateStr(new Date());
  const upcomingEvents = useMemo(() => {
    return events
      .filter(ev => ev.date >= todayStr)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  }, [events, todayStr]);

  const completedEvents = useMemo(() => {
    return events
      .filter(ev => ev.date < todayStr)
      .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
  }, [events, todayStr]);

  const filteredCompanySuggestions = useMemo(() => {
    const input = formData.company.trim().toLowerCase();
    if (!input) return summaryStats.uniqueCompaniesList;
    return summaryStats.uniqueCompaniesList.filter(comp =>
      comp.toLowerCase().includes(input)
    );
  }, [formData.company, summaryStats.uniqueCompaniesList]);

  const scrollToThisMonth = (behavior = 'smooth') => {
    const container = scrollRef.current;
    const target = document.getElementById('month-0');
    if (container && target) {
      container.scrollTo({
        top: target.offsetTop - 20,
        behavior
      });
    }
  };

  const handleCalendarScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop < clientHeight + 400) {
      setRangeEndOffset(prev => prev + 2);
    }
    if (scrollTop < 100) {
      setRangeStartOffset(prev => prev - 2);
    }
  };

  const checkCollision = (newDate, newStart, newEnd, ignoreId) => {
    const start = new Date(`${newDate}T${newStart}`);
    const end = new Date(`${newDate}T${newEnd}`);
    return events.some(ev => {
      if (ev.id === ignoreId || ev.date !== newDate) return false;
      const evStart = new Date(`${ev.date}T${ev.startTime}`);
      const evEnd = new Date(`${ev.date}T${ev.endTime}`);
      return (start < evEnd && end > evStart);
    });
  };

  useEffect(() => {
    if (showModal) {
      setCollisionWarning(checkCollision(formData.date, formData.startTime, formData.endTime, editingId));
    }
  }, [formData.date, formData.startTime, formData.endTime, showModal, editingId, events]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !formData.company.trim()) return;

    if (editingId) {
      await updateDoc(
        doc(db, 'users', user.uid, 'events', editingId),
        formData
      );
    } else {
      await addDoc(
        collection(db, 'users', user.uid, 'events'),
        formData
      );
    }

    setShowModal(false);
    setShowCompanyDropdown(false);
    setEditingId(null);
    resetForm();
    setParsedImageResult(null);
  };

  const handleEditClick = (ev) => {
    setEditingId(ev.id);
    setFormData({
      company: ev.company || '',
      date: ev.date || getLocalDateStr(new Date()),
      startTime: ev.startTime || '10:00',
      endTime: ev.endTime || '11:00',
      stage: ev.stage || '一面',
      type: ev.type || '線上',
      status: ev.status || 'confirmed',
      notes: ev.notes || ''
    });
    setShowModal(true);
  };

  const openRecordModal = (ev) => {
    setRecordEvent(ev);
    setNotesText(ev.notes || '');
    setShowRecordModal(true);
  };

  const handleSaveRecord = async () => {
    if (!recordEvent || !user) return;

    await updateDoc(
      doc(db, 'users', user.uid, 'events', recordEvent.id),
      { notes: notesText }
    );

    setShowRecordModal(false);
    setRecordEvent(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsingAI(true);
    setParsedImageResult(null);

    try {
      const base64Image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });

      const todayPromptStr = getLocalDateStr(new Date());
      const prompt = `這是一張面試邀請的截圖。今天是 ${todayPromptStr}。請幫我從中提取出以下資訊，並嚴格以 JSON 格式回傳，不要加上任何 markdown 或其他文字：{"company": "公司名稱", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM"}。`;

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image: base64Image, mimeType: file.type || 'image/jpeg' }),
      });

      if (!response.ok) throw new Error('AI Parse Error');
      const data = await response.json();
      let aiText = data.text || '';
      aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
      setParsedImageResult(JSON.parse(aiText));

    } catch (error) {
      console.error("AI 讀取失敗", error);
    } finally {
      setIsParsingAI(false);
      if (imageInputRef.current) imageInputRef.current.value = null;
    }
  };

  const applyAiResult = () => {
    if (!parsedImageResult) return;
    setFormData({
      ...formData,
      company: parsedImageResult.company || formData.company,
      date: parsedImageResult.date || formData.date,
      startTime: parsedImageResult.startTime || formData.startTime,
      endTime: parsedImageResult.endTime || formData.endTime
    });
    setParsedImageResult(null);
  };

  const handleCsvImport = (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    const eventsRef = collection(db, 'users', user.uid, 'events');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');
        if (lines.length < 2) return;
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        let nameIdx = headers.findIndex(h => h.includes('name') || h.includes('公司'));
        if (nameIdx === -1) nameIdx = 0;

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const row = lines[i].split(',');
          let company = row[nameIdx]?.trim() || '未命名公司';
          await addDoc(eventsRef, {
            company,
            date: getLocalDateStr(new Date()),
            startTime: '10:00',
            endTime: '11:00',
            stage: '一面',
            type: '線上',
            status: 'confirmed',
            notes: ''
          });
        }
      } catch (err) { console.error(err); }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const today = new Date();
  const months = [];
  for (let offset = rangeStartOffset; offset <= rangeEndOffset; offset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    months.push({ offset, year: d.getFullYear(), month: d.getMonth() });
  }

  const currentTabEvents = activeTab === 'upcoming' ? upcomingEvents : completedEvents;

  return (
    <div className="h-screen flex flex-col bg-[#fafbfc] text-slate-900 font-sans antialiased overflow-hidden">
      {/* 頂部 Header */}
      <div className="flex justify-between items-center px-4 md:px-6 py-3 bg-white border-b border-slate-200/80 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">面試行事曆</h1>
            <p className="text-[11px] text-slate-400 font-normal">高效掌握求職進度與行程</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSummaryModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-slate-600" /> 統計總結
          </button>
          <button
            onClick={() => scrollToThisMonth()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" /> 回到本月
          </button>
        </div>
      </div>

      {/* 主工作區：左側 SideBar + 右側日曆 Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* 左側 SideBar 清單 */}
        <div className="w-full md:w-80 border-r border-slate-200/80 bg-white flex flex-col flex-shrink-0 h-96 md:h-full">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'upcoming'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                即將到來
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'completed'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                已完成
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {currentTabEvents.map(ev => (
              <div
                key={ev.id}
                className="p-3.5 rounded-2xl border border-slate-100 bg-white shadow-2xs space-y-2 hover:border-slate-200 transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-slate-900">{ev.company}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                    {ev.status === 'proposed' ? '提議中' : '已確認'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1 font-medium">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ev.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ev.startTime} - {ev.endTime}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${getStageColor(ev.stage)}`}>
                    {ev.stage || '一面'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 font-medium">
                    {ev.type === '實體' ? '@ 實體' : '🎥 線上'}
                  </span>
                </div>

                <div className="pt-2 space-y-1">
                  <button
                    onClick={() => openRecordModal(ev)}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    {ev.notes ? '檢視面試紀錄' : '新增面試紀錄'}
                  </button>
                  <button
                    onClick={() => handleEditClick(ev)}
                    className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 font-medium pt-1"
                  >
                    修改日期 / 時間 / 關卡
                  </button>
                </div>
              </div>
            ))}

            {currentTabEvents.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs font-medium">
                {activeTab === 'upcoming' ? '目前沒有即將到來的面試行程' : '尚無已完成的面試紀錄'}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-white space-y-2 flex-shrink-0">
            <input type="file" ref={csvInputRef} accept=".csv" onChange={handleCsvImport} className="hidden" />
            <button
              onClick={() => { setEditingId(null); resetForm(); setShowModal(true); }}
              className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" /> 新增行程 / 提議時段
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              className="w-full text-slate-400 hover:text-slate-600 text-[11px] font-medium py-1 transition-colors text-center"
            >
              匯入 Notion 資料 (CSV)
            </button>
          </div>
        </div>

        {/* 📅 右側日曆 GRID (已完全移除 Today 效果) */}
        <div ref={scrollRef} onScroll={handleCalendarScroll} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-[#fafbfc]">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 max-w-5xl mx-auto">
            <span>🗓️ 互動式行事曆</span>
          </div>

          {months.map(({ offset, year, month }) => {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = new Date(year, month, 1).getDay();
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const blanks = Array.from({ length: firstDay }, (_, i) => i);

            return (
              <div key={`${year}-${month}`} id={`month-${offset}`} className="max-w-5xl mx-auto">
                <h2 className="text-sm md:text-base font-extrabold text-slate-900 mb-3">
                  {year} 年 {month + 1} 月
                </h2>

                <div className="grid grid-cols-7 mb-2 text-center font-bold text-slate-400 text-[11px] tracking-wider">
                  <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
                </div>

                <div className="grid grid-cols-7 border-l border-t border-slate-200 bg-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  {blanks.map(b => (
                    <div key={`b-${b}`} className="bg-slate-50/60 border-r border-b border-slate-200 min-h-[95px] md:min-h-[115px]"></div>
                  ))}
                  {days.map(day => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEvents = events.filter(e => e.date === dateStr);

                    return (
                      <div
                        key={day}
                        className="border-r border-b border-slate-200 p-1.5 md:p-2 min-h-[95px] md:min-h-[115px] flex flex-col transition-colors bg-white"
                      >
                        {/* 純淨標準日期標題 (無背景、無圓圈) */}
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-slate-800 px-1">
                            {day}
                          </span>
                        </div>

                        <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                          {dayEvents.map(ev => (
                            <div
                              key={ev.id}
                              className="text-[10px] p-1.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition-all flex flex-col gap-0.5"
                            >
                              <div className="flex items-center gap-1 text-slate-500 text-[9px] font-semibold">
                                <Video className="w-2.5 h-2.5 flex-shrink-0 text-slate-400" />
                                <span className="truncate">{ev.startTime}</span>
                              </div>
                              <div className="font-bold text-slate-900 truncate leading-tight">{ev.company}</div>
                              <span className={`self-start text-[8px] px-1.5 py-0.5 rounded-md border font-semibold mt-0.5 ${getStageColor(ev.stage)}`}>
                                {ev.stage || '一面'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 統計數據儀表板 Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" /> 求職面試統計總結
              </h3>
              <button type="button" onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mb-1">
                  <Layers className="w-3.5 h-3.5" /> 總面試場次
                </div>
                <span className="text-3xl font-black text-slate-900">{summaryStats.totalInterviews} 場</span>
              </div>

              <div
                onClick={() => setShowCompanyListInSummary(!showCompanyListInSummary)}
                className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100/80 cursor-pointer hover:bg-indigo-100/70 transition-all"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="flex items-center gap-1.5 text-indigo-600 text-xs font-bold">
                    <Building2 className="w-3.5 h-3.5" /> 面試公司數
                  </span>
                  <span className="text-[10px] text-indigo-600 font-bold bg-white/80 px-1.5 py-0.5 rounded-md">
                    {showCompanyListInSummary ? '收起 ▲' : '展開 ▾'}
                  </span>
                </div>
                <span className="text-3xl font-black text-indigo-950">{summaryStats.totalCompanies} 間</span>
              </div>
            </div>

            {showCompanyListInSummary && (
              <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100/60 animate-fadeIn">
                <div className="text-[11px] font-bold text-indigo-800 mb-2">已應徵面試公司列表：</div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {summaryStats.uniqueCompaniesList.map((comp, idx) => (
                    <span key={idx} className="bg-white border border-indigo-200/80 text-indigo-900 text-xs px-2.5 py-1 rounded-xl font-bold shadow-2xs">
                      {comp}
                    </span>
                  ))}
                  {summaryStats.uniqueCompaniesList.length === 0 && (
                    <span className="text-xs text-slate-400">尚無公司紀錄</span>
                  )}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">面試關卡分佈</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(summaryStats.stageCounts).map(([stage, count]) => (
                  <div key={stage} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <span className="font-semibold text-slate-600">{stage}</span>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border text-[11px]">{count} 場</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 獨立面試紀錄 Modal */}
      {showRecordModal && recordEvent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" /> 面試紀錄與筆記
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{recordEvent.company} · {recordEvent.date}</p>
              </div>
              <button type="button" onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">檢討筆記 / 面試考題 / Follow-up 備忘錄</label>
              <textarea
                rows={5}
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white"
                placeholder="記錄面試官問的問題、薪資範圍或需改進的地方..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowRecordModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">取消</button>
              <button type="button" onClick={handleSaveRecord} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800">儲存筆記</button>
            </div>
          </div>
        </div>
      )}

      {/* 新增 / 編輯 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center sticky top-0 bg-white pb-2 border-b border-slate-100 z-10">
              <h3 className="font-bold text-sm text-slate-900">{editingId ? '編輯面試行程' : '新增面試行程'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full py-2.5 border border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl text-indigo-700 font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" /> 上傳面試信件截圖 (AI 自動填寫)
              </button>

              {isParsingAI && (
                <div className="mt-2 p-2 bg-slate-100 rounded-lg flex items-center gap-2 text-xs text-slate-600 animate-pulse font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在解析截圖內容...
                </div>
              )}

              {parsedImageResult && (
                <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                  <div className="flex items-center gap-1 text-emerald-700 font-bold mb-1">
                    <Check className="w-3.5 h-3.5" /> 辨識成功！
                  </div>
                  <div className="text-slate-600 text-[11px] space-y-0.5 mb-2 font-medium">
                    <p>公司：<span className="font-bold text-slate-900">{parsedImageResult.company || '未找到'}</span></p>
                    <p>時間：<span className="font-bold text-slate-900">{parsedImageResult.date} {parsedImageResult.startTime} - {parsedImageResult.endTime}</span></p>
                  </div>
                  <button type="button" onClick={applyAiResult} className="w-full py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700">帶入表單</button>
                </div>
              )}
            </div>

            {collisionWarning && (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-center gap-2 border border-amber-200 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>注意！這個時段已經有安排其他面試了，請確認是否會撞期。</span>
              </div>
            )}

            {/* 自訂 Combobox */}
            <div className="relative" ref={companyInputRef}>
              <label className="block text-xs font-bold text-slate-700 mb-1">公司名稱 *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.company}
                  onFocus={() => setShowCompanyDropdown(true)}
                  onChange={(e) => {
                    setFormData({ ...formData, company: e.target.value });
                    setShowCompanyDropdown(true);
                  }}
                  className="w-full px-3 py-2.5 pr-8 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none font-medium"
                  placeholder="例如：Google (點擊可選擇歷史公司)"
                />
                <ChevronDown
                  className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 cursor-pointer"
                  onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                />
              </div>

              {showCompanyDropdown && filteredCompanySuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50 p-1 custom-scrollbar">
                  {filteredCompanySuggestions.map((comp, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setFormData({ ...formData, company: comp });
                        setShowCompanyDropdown(false);
                      }}
                      className="px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    >
                      {comp}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">日期</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">關卡</label>
                <select
                  value={formData.stage}
                  onChange={e => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                >
                  <option value="HR Call">HR Call</option>
                  <option value="一面">一面</option>
                  <option value="二面">二面</option>
                  <option value="三面 / 最終面">三面 / 最終面</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">形式</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                >
                  <option value="線上">線上</option>
                  <option value="實體">實體</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">狀態</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                >
                  <option value="confirmed">已確認</option>
                  <option value="proposed">提議中</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">開始時間</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={e => {
                    const newStart = e.target.value;
                    setFormData({
                      ...formData,
                      startTime: newStart,
                      endTime: addOneHour(newStart)
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">結束時間</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">取消</button>
              <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800">儲存</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}