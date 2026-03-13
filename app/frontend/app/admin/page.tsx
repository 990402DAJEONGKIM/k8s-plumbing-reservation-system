"use client";
import { useState, useEffect } from 'react';
import { 
  ClipboardList, Calendar, Users, Activity, Settings, 
  Search, Bell, LogOut, HeartPulse, CheckCircle2, Truck, Wrench, History
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState('시스템 모니터링');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState({ reservations: [], customers: [], calendar: [] });
  const [todayCount, setTodayCount] = useState(0);

  const loadData = async () => {
    try {
      const baseUrl = 'http://localhost:4000/api/admin';
      if (activeMenu === '예약 관리') {
        const res = await fetch(`${baseUrl}/reservations?status=${filter}&search=${search}`);
        const result = await res.json();
        if (result.success) {
          setData(p => ({ ...p, reservations: result.list }));
          const today = new Date().toISOString().split('T')[0];
          setTodayCount(result.list.filter((i:any) => i.created_at.startsWith(today)).length);
        }
      } 
      else if (activeMenu === '고객 관리') {
        const res = await fetch(`${baseUrl}/customers?search=${search}`);
        const result = await res.json();
        if (result.success) setData(p => ({ ...p, customers: result.list }));
      }
      else if (activeMenu === '일정 조회') {
        const res = await fetch(`${baseUrl}/calendar`);
        const result = await res.json();
        if (result.success) setData(p => ({ ...p, calendar: result.list }));
      }
    } catch (e) { console.error("데이터 로드 실패"); }
  };

  useEffect(() => { loadData(); }, [activeMenu, filter, search]);

  const changeStatus = async (id: number, status: string) => {
    await fetch(`http://localhost:4000/api/admin/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    loadData();
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900">
      <aside className="w-72 bg-[#1a1f2e] text-white flex flex-col p-6 shrink-0 shadow-2xl">
        <div className="flex items-center gap-3 mb-10 p-2 font-black italic text-xl">
          <HeartPulse className="text-indigo-500" size={28} /> Plumbing Admin
        </div>
        <nav className="space-y-1.5 flex-grow">
          {[
            { n: '예약 관리', i: <ClipboardList size={20}/> },
            { n: '일정 조회', i: <Calendar size={20}/> },
            { n: '고객 관리', i: <Users size={20}/> },
            { n: '시스템 모니터링', i: <Activity size={20}/> },
            { n: '설정', i: <Settings size={20}/> }
          ].map(m => (
            <button key={m.n} onClick={() => {setActiveMenu(m.n); setSearch('');}} 
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[20px] font-bold transition-all ${activeMenu === m.n ? 'bg-indigo-600 shadow-lg shadow-indigo-900/40' : 'text-slate-400 hover:bg-slate-800'}`}>
              {m.i} {m.n}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b px-10 flex items-center justify-between shadow-sm z-10">
          <div className="relative w-96">
            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
            <input type="text" placeholder={`${activeMenu} 내 검색...`} value={search} onChange={(e) => setSearch(e.target.value)} 
              className="w-full bg-slate-100 pl-12 pr-4 py-2.5 rounded-2xl outline-none focus:ring-2 ring-indigo-500/20" />
          </div>
          <div className="font-bold text-sm">오늘 점검 예정: <span className="text-indigo-600 font-black underline underline-offset-4">{todayCount}건</span></div>
        </header>

        <div className="p-10 overflow-y-auto bg-[#f8fafc]">
          {activeMenu === '예약 관리' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black italic tracking-tighter">예약 현황 관리</h2>
                <div className="flex bg-slate-200 p-1 rounded-xl gap-1">
                  {['ALL', 'PENDING', 'ASSIGNED', 'REPAIRING', 'COMPLETED'].map(s => (
                    <button key={s} onClick={() => setFilter(s)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filter === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4">
                {data.reservations.map((item: any) => (
                  <div key={item.id} className="bg-white p-6 rounded-[35px] border flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                    <div className="flex gap-6 items-center">
                      <div className={`p-4 rounded-2xl ${item.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'}`}>
                        {item.status === 'COMPLETED' ? <CheckCircle2 size={24}/> : (item.status === 'ASSIGNED' ? <Truck size={24}/> : <Wrench size={24}/>)}
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.res_number}</p>
                        <h3 className="text-xl font-black italic">{item.customer_name} 님</h3>
                        <p className="text-sm text-slate-500 font-bold">{item.issue_type} | {item.address}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => changeStatus(item.id, 'ASSIGNED')} className="px-4 py-2 bg-slate-50 text-slate-600 text-[11px] font-black rounded-xl hover:bg-indigo-600 hover:text-white transition">배정</button>
                      <button onClick={() => changeStatus(item.id, 'REPAIRING')} className="px-4 py-2 bg-slate-50 text-slate-600 text-[11px] font-black rounded-xl hover:bg-orange-500 hover:text-white transition">수리</button>
                      <button onClick={() => changeStatus(item.id, 'COMPLETED')} className="px-4 py-2 bg-slate-50 text-slate-600 text-[11px] font-black rounded-xl hover:bg-emerald-500 hover:text-white transition">완료</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMenu === '고객 관리' && (
            <div className="space-y-6 animate-in fade-in">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">Customers</h2>
              <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-slate-400 text-[11px] uppercase tracking-widest font-black">
                      <th className="p-6">고객 / 연락처</th>
                      <th className="p-6">최근 방문 주소</th>
                      <th className="p-6 text-center">방문 횟수</th>
                      <th className="p-6 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.customers.map((cust: any, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="p-6">
                          <p className="font-black italic text-slate-800 text-lg">{cust.customer_name} 님</p>
                          <p className="text-xs text-slate-400 font-bold">{cust.phone_number}</p>
                        </td>
                        <td className="p-6 text-sm text-slate-500 font-bold max-w-[250px] truncate">{cust.address || "정보 없음"}</td>
                        <td className="p-6 text-center"><span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black">{cust.visit_count}회</span></td>
                        <td className="p-6 text-right">
                          <button onClick={() => {setSearch(cust.customer_name); setActiveMenu('예약 관리');}} 
                            className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl text-xs font-black italic flex items-center gap-2 ml-auto transition">
                            <History size={14}/> 히스토리 보기
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 시스템 모니터링 섹션 */}
          {activeMenu === '시스템 모니터링' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">Infra Status</h2>
              <div className="grid grid-cols-3 gap-8">
                <StatCard label="CPU Usage" val="12.4%" color="bg-[#10b981]" />
                <StatCard label="Memory" val="42.1%" color="bg-[#6366f1]" />
                <StatCard label="Error Logs" val="0" color="bg-[#f43f5e]" />
              </div>
              <div className="bg-[#1a1f2e] rounded-[48px] p-20 h-[400px] flex items-center justify-center text-slate-600 border border-slate-800 shadow-2xl relative">
                <Activity size={80} className="opacity-10 absolute animate-pulse" />
                <span className="font-black italic tracking-[0.3em] opacity-40">GRAFANA DASHBOARD</span>
              </div>
            </div>
          )}

          {activeMenu === '일정 조회' && (
            <div className="space-y-6 animate-in fade-in">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase text-left">Calendar</h2>
              <div className="grid grid-cols-4 gap-6">
                {data.calendar.map((c: any) => (
                  <div key={c.date} className="bg-white p-8 rounded-[40px] border shadow-sm text-center">
                    <p className="text-slate-400 font-black text-xs mb-3">{c.date}</p>
                    <p className="text-4xl font-black text-indigo-600 italic">{c.count}<span className="text-lg ml-1">건</span></p>
                  </div>
                ))}
              </div>
            </div>
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