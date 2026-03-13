"use client";
import { useState, useEffect } from 'react';
import { 
  ClipboardList, Calendar, Users, Activity, Settings, 
  Search, Bell, LogOut, HeartPulse, CheckCircle2, Truck, Wrench, History, AlertCircle
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState('시스템 모니터링');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState({ reservations: [], customers: [] });
  const [sysStats, setSysStats] = useState({ cpu: '0%', mem: '0%', errCount: 0, logs: [] });

  const loadData = async () => {
    try {
      const baseUrl = 'http://localhost:4000/api/admin';
      if (activeMenu === '예약 관리') {
        const res = await fetch(`${baseUrl}/reservations?status=${filter}&search=${search}`);
        const result = await res.json();
        if (result.success) setData(p => ({ ...p, reservations: result.list }));
      } 
      else if (activeMenu === '고객 관리') {
        const res = await fetch(`${baseUrl}/customers?search=${search}`);
        const result = await res.json();
        if (result.success) setData(p => ({ ...p, customers: result.list }));
      }
    } catch (e) { console.error("데이터 로드 실패"); }
  };

  // 실시간 모니터링 (2초마다 에러 로그까지 가져옴)
  useEffect(() => {
    const fetchMonitor = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/admin/monitor-data');
        const result = await res.json();
        if (result.success) {
          setSysStats({ cpu: result.cpu, mem: result.mem, errCount: result.errCount, logs: result.logs });
        }
      } catch (e) { console.error("모니터링 실패"); }
    };
    fetchMonitor();
    const timer = setInterval(fetchMonitor, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { loadData(); }, [activeMenu, filter, search]);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <aside className="w-72 bg-[#1a1f2e] text-white flex flex-col p-6 shrink-0 shadow-2xl">
        <div className="flex items-center gap-3 mb-10 p-2 font-black italic text-xl">
          <HeartPulse className="text-indigo-500" size={28} /> Plumbing Admin
        </div>
        <nav className="space-y-1.5 flex-grow">
          {['예약 관리', '일정 조회', '고객 관리', '시스템 모니터링', '설정'].map((menu) => (
            <button key={menu} onClick={() => {setActiveMenu(menu); setSearch('');}} 
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[20px] font-bold transition-all ${activeMenu === menu ? 'bg-indigo-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
              {menu === '예약 관리' && <ClipboardList size={20}/>}
              {menu === '일정 조회' && <Calendar size={20}/>}
              {menu === '고객 관리' && <Users size={20}/>}
              {menu === '시스템 모니터링' && <Activity size={20}/>}
              {menu === '설정' && <Settings size={20}/>}
              {menu}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b px-10 flex items-center justify-between shadow-sm z-10 font-bold">
          <div className="relative w-96">
            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
            <input type="text" placeholder={`${activeMenu} 내 검색...`} value={search} onChange={(e) => setSearch(e.target.value)} 
              className="w-full bg-slate-100 pl-12 pr-4 py-2.5 rounded-2xl outline-none focus:ring-2 ring-indigo-500/20" />
          </div>
          <div className="text-sm">오늘 접수: <span className="text-indigo-600 font-black">{data.reservations.length}건</span></div>
        </header>

        <div className="p-10 overflow-y-auto bg-[#f8fafc]">
          {activeMenu === '시스템 모니터링' && (
            <div className="space-y-10 animate-in fade-in duration-700">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">Infra Monitoring</h2>
              
              <div className="grid grid-cols-3 gap-8">
                <StatCard label="CPU Usage" val={sysStats.cpu} color="bg-[#10b981]" />
                <StatCard label="Memory" val={sysStats.mem} color="bg-[#6366f1]" />
                <StatCard label="Error Logs" val={String(sysStats.errCount)} color="bg-[#f43f5e]" />
              </div>

              {/* 실시간 에러 로그 메시지창 추가 */}
              <div className="bg-white rounded-[40px] p-10 border shadow-sm space-y-6">
                <h3 className="text-xl font-black italic flex items-center gap-2">
                  <AlertCircle className="text-rose-500" size={24}/> Recent Error Messages
                </h3>
                <div className="space-y-3">
                  {sysStats.logs.length > 0 ? sysStats.logs.map((log: any) => (
                    <div key={log.id} className="bg-rose-50 p-5 rounded-2xl flex justify-between items-center border border-rose-100 animate-in zoom-in duration-300">
                      <span className="text-rose-700 font-bold text-sm italic underline decoration-rose-200 uppercase tracking-tight">{log.message}</span>
                      <span className="text-slate-400 text-xs font-mono">{log.time}</span>
                    </div>
                  )) : (
                    <div className="py-10 text-center text-slate-300 font-black italic border-2 border-dashed rounded-3xl">System Status: Stable (0 Errors)</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 예약 관리 & 고객 관리 UI는 이전과 동일 */}
          {activeMenu === '예약 관리' && (
             <div className="p-10 text-center font-bold text-slate-400 border-2 border-dashed rounded-3xl italic">예약 관리 데이터 로드됨... (목록 생략)</div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, val, color }: any) {
  return (
    <div className={`${color} p-10 rounded-[45px] text-white shadow-2xl relative overflow-hidden`}>
      <p className="text-xs font-black opacity-70 uppercase tracking-widest">{label}</p>
      <p className="text-5xl font-black mt-3 italic tracking-tighter">{val}</p>
    </div>
  );
}