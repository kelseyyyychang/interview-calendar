import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc } from 'firebase/firestore';
import { Calendar as CalendarIcon, Plus, X, Upload } from 'lucide-react';

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

export default function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const csvInputRef = useRef(null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company.trim()) return;
    await addDoc(collection(db, 'events'), formData);
    setShowModal(false);
    setFormData({ ...formData, company: '' });
  };

  // Notion CSV 解析與批次匯入邏輯
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

        let dateIdx = headers.findIndex(h => h.includes('date') || h.includes('時間') || h.includes('日期'));
        let statusIdx = headers.findIndex(h => h.includes('status') || h.includes('狀態'));

        const eventsRef = collection(db, 'events');

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const row = [];
          let inQuotes = false;
          let currentVal = '';
          for (let char of lines[i]) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { row.push(currentVal); currentVal = ''; }
            else currentVal += char;
          }
          row.push(currentVal);

          if (dateIdx === -1 || row.length <= Math.max(nameIdx, dateIdx)) continue;

          let company = row[nameIdx].trim();
          company = company.replace(/https?:\/\/[^\s]+|www\.[^\s]+/g, '').trim();
          if (company.startsWith('[')) company = company.split(']')[0].substring(1).trim();

          const dateStr = row[dateIdx].trim();
          let dateVal = getLocalDateStr(new Date());
          let startTime = '10:00';
          let endTime = '11:00';

          const dateMatch = dateStr.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
          if (dateMatch) {
            dateVal = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
          }

          let status = 'confirmed';
          if (statusIdx !== -1 && row[statusIdx]) {
            const s = row[statusIdx].toLowerCase();
            if (s.includes('proposed') || s.includes('提議') || s.includes('未定')) {
              status = 'proposed';
            }
          }

          await addDoc(eventsRef, {
            company: company || '未命名公司',
            date: dateVal,
            startTime,
            endTime,
            stage: '一面',
            type: '線上',
            status
          });
        }
      } catch (err) {
        console.error('CSV 匯入失敗：', err);
      }
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
          {/* CSV 匯入隱藏 Input 與按鈕 */}
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
            onClick={() => setShowModal(true)}
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
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
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