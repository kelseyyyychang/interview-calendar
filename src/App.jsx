import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc } from 'firebase/firestore';
import { Calendar as CalendarIcon, Plus, X, Upload, AlertCircle, Sparkles, Loader2, Check } from 'lucide-react';

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

// 時間加 1 小時輔助函式
const addOneHour = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return '11:00';
  const [h, m] = timeStr.split(':').map(Number);
  const newH = (h + 1) % 24;
  return `${String(newH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [collisionWarning, setCollisionWarning] = useState(false);

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
    status: 'confirmed'
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'events'), (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user]);

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
    if (!formData.company.trim()) return;
    await addDoc(collection(db, 'events'), formData);
    setShowModal(false);
    setFormData({ ...formData, company: '' });
    setParsedImageResult(null);
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

      const todayStr = getLocalDateStr(new Date());
      const prompt = `這是一張面試邀請的截圖。今天是 ${todayStr}。請幫我從中提取出以下資訊，並嚴格以 JSON 格式回傳，不要加上任何 markdown 或其他文字：{"company": "公司名稱", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM"}。`;

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image: base64Image,
          mimeType: file.type || 'image/jpeg',
        }),
      });

      if (!response.ok) throw new Error('AI Parse Error');

      const data = await response.json();
      let aiText = data.text || '';
      aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(aiText);
      setParsedImageResult(parsedData);

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
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        let nameIdx = headers.findIndex(h => h.includes('name') || h.includes('公司'));
        if (nameIdx === -1) nameIdx = 0;

        const eventsRef = collection(db, 'events');
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
            status: 'confirmed'
          });
        }
      } catch (err) { console.error(err); }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-white text-slate-900 p-6 font-sans">
      {/* 頁首 Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CalendarIcon className="w-6 h-6" /> 面試行事曆 MVP
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={csvInputRef}
            accept=".csv"
            onChange={handleCsvImport}
            className="hidden"
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-4 h-4" /> 匯入 Notion CSV
          </button>

          <button
            onClick={() => { setEditingId(null); setParsedImageResult(null); setShowModal(true); }}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> 新增行程
          </button>
        </div>
      </div>

      {/* 1~31 簡約網格 */}
      <div className="border border-slate-900 rounded-2xl p-4">
        <div className="grid grid-cols-7 gap-3">
          {days.map(day => {
            const dayEvents = events.filter(e => {
              const d = new Date(e.date);
              return d.getDate() === day;
            });

            return (
              <div key={day} className="border border-slate-900 rounded-xl p-3 h-28 flex flex-col justify-between">
                <span className="font-bold text-sm">{day}</span>
                <div className="space-y-1 overflow-y-auto">
                  {dayEvents.map(ev => (
                    <div key={ev.id} className="text-xs bg-slate-100 p-1 rounded font-medium truncate">
                      {ev.startTime} {ev.company}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 新增 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-900 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">新增面試行程</h3>
              <button type="button" onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="border-b border-slate-200 pb-3">
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" /> 上傳面試信件截圖 (AI 自動填寫)
              </button>

              {isParsingAI && (
                <div className="mt-2 p-2 bg-slate-100 rounded-lg flex items-center gap-2 text-xs text-slate-600 animate-pulse font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在解析截圖內容...</span>
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
                  <button
                    type="button"
                    onClick={applyAiResult}
                    className="w-full py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors"
                  >
                    帶入表單
                  </button>
                </div>
              )}
            </div>

            {collisionWarning && (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-center gap-2 border border-amber-200 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>注意！這個時段已經有安排其他面試了，請確認是否會撞期。</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1">公司名稱</label>
              <input
                type="text"
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                placeholder="例如：Google"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">日期</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1">開始時間</label>
                {/* 🎯 開始時間連動自動 +1hr 結束時間 */}
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
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">結束時間</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-xl text-sm font-bold">儲存</button>
          </form>
        </div>
      )}
    </div>
  );
}