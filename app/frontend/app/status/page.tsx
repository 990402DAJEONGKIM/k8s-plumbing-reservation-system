"use client";

import { useState, useEffect } from 'react';
import { Search, Clock, Phone, Wrench, CheckCircle2, PackageCheck, Construction, RefreshCcw, Megaphone } from 'lucide-react';
import { useAnnouncements } from '../../lib/hooks';

export default function StatusPage() {
  const [resNumber, setResNumber] = useState('');
  const [data, setData] = useState<any>(null);
  const [isMaintenance, setIsMaintenance] = useState(false); // 점검 상태 관리
  const announcements = useAnnouncements(); // 공지사항 상태

  const onSearch = async () => {
    if (!resNumber) return;
    setIsMaintenance(false); // 검색 시 점검 상태 초기화

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/admin/reservations?search=${resNumber.trim()}`);
      if (res.status === 503) {
        setIsMaintenance(true);
        return;
      }
      const result = await res.json();
      if (res.ok && result.success && result.list && result.list.length > 0) {
        setData(result.list[0]);
      } else {
        alert("일치하는 예약 번호가 없습니다. 번호를 다시 확인해주세요.");
        setData(null);
      }
    } catch (err: any) {
      alert("서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.");
      setData(null);
    }
  };

  const steps = [
    { label: '접수', val: 'PENDING', icon: <Clock size={20} /> },
    { label: '배정', val: 'ASSIGNED', icon: <Phone size={20} /> },
    { label: '수리중', val: 'REPAIRING', icon: <Wrench size={20} /> },
    { label: '완료', val: 'COMPLETED', icon: <PackageCheck size={20} /> },
  ];

  // 🚧 [추가] 서버 점검 전용 UI 뷰
  if (isMaintenance) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white p-12 rounded-[50px] shadow-2xl text-center space-y-8 border-t-[16px] border-amber-400">
          <div className="flex justify-center text-amber-500 animate-bounce">
            <Construction size={80} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black italic text-slate-800 uppercase tracking-tighter">
              Under <br /> <span className="text-amber-500">Maintenance</span>
            </h1>
            <p className="text-slate-500 font-bold leading-relaxed">
              더 나은 서비스를 위해 시스템 점검 중입니다. <br />
              잠시 후 다시 접속해 주세요.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-5 bg-slate-900 text-white rounded-3xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all font-black italic uppercase text-sm shadow-xl"
          >
            <RefreshCcw size={18} className="animate-spin-reverse" /> 
            새로고침
          </button>
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest pt-4">
            Plumbing Admin System
          </p>
        </div>
      </div>
    );
  }

  // 데이터가 없을 때를 대비한 안전한 상태 값 추출
  const currentStatus = (data?.status || 'PENDING').toUpperCase();
  const current = steps.findIndex(s => s.val === currentStatus);

  return (
    <div className="min-h-screen bg-[#2b1c6d] py-20 px-4 text-white font-sans">
      <div className="max-w-4xl mx-auto space-y-12 text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-lg">
          Track <span className="text-red-500">Service</span>
        </h1>
        
        {/* 검색바 영역 */}
        <div className="flex bg-white p-2 rounded-sm border-b-8 border-red-600 shadow-2xl">
          <input 
            type="text" 
            className="flex-grow p-4 text-black text-2xl font-black outline-none" 
            placeholder="예: RES-12345678" 
            value={resNumber}
            onChange={e => setResNumber(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <button onClick={onSearch} className="bg-red-600 p-4 hover:bg-red-700 transition">
            <Search size={32} />
          </button>
        </div>

        {/* 조회 결과 영역 */}
        {data && (
          <div className="bg-white p-12 shadow-2xl rounded-sm animate-in fade-in zoom-in duration-500 text-left text-black">
            {/* 진행 상태 바 (그래프) */}
            <div className="relative flex justify-between items-center mb-24 px-4">
              <div className="absolute w-[90%] h-1 bg-gray-200 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
              <div 
                className="absolute h-1 bg-red-600 top-1/2 left-[5%] -translate-y-1/2 transition-all duration-1000" 
                style={{ width: `${current >= 0 ? (current / (steps.length - 1)) * 90 : 0}%` }}
              ></div>
              {steps.map((s, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-colors duration-500 ${
                    i <= current ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-200 text-gray-300'
                  }`}>
                    {i < current ? <CheckCircle2 size={24} /> : s.icon}
                  </div>
                  <span className={`absolute -bottom-10 font-black text-xs uppercase whitespace-nowrap tracking-tighter ${
                    i <= current ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* 상세 정보 레이아웃 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-gray-100 pt-10 font-black italic">
              <div className="space-y-3 text-left">
                <p className="text-[10px] text-red-600 uppercase border-l-4 border-red-600 pl-2">Customer Detail</p>
                <p className="text-4xl text-[#2b1c6d] tracking-tighter">{data.customer_name} 님</p>
                <p className="text-gray-500 not-italic font-bold text-sm tracking-tight">
                  {data.address} <br /> {data.phone_number}
                </p>
              </div>
              <div className="space-y-3 text-left">
                <p className="text-[10px] text-red-600 uppercase border-l-4 border-red-600 pl-2">Service Status</p>
                <p className="text-4xl text-red-600 uppercase tracking-tighter">{data.issue_type || '배관 수리'}</p>
                <p className="text-gray-500 not-italic font-bold text-sm">
                  접수일: {new Date(data.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-dotted text-right text-[10px] text-gray-300 font-bold uppercase tracking-widest">
              Reference: {data.res_number}
            </div>
          </div>
        )}

        {/* 공지사항 영역 */}
        {announcements.length > 0 && (
          <div className="mt-20 text-left animate-in fade-in duration-500">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3 mb-6">
              <Megaphone size={28} className="text-red-500"/>
              Announcements
            </h2>
            <div className="space-y-4">
              {announcements.map(item => (
                <div key={item.id} className="bg-white/10 p-6 rounded-lg border-l-4 border-red-500">
                  <h3 className="text-xl font-black italic">{item.title}</h3>
                  <p className="text-white/80 font-bold mt-2">{item.content}</p>
                  <p className="text-xs text-white/40 font-mono mt-3">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}