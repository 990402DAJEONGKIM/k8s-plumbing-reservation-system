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

  // 데이터 로딩
  const loadData = async () => {
    const baseUrl = 'http://localhost:4000/api/admin';
    try {
      if (activeMenu === '예약 관리') {
        const res = await fetch(`${baseUrl}/reservations?status=${filter}&search=${search}`);
        const result = await res.json();
        if (result.success) setData(p => ({ ...p, reservations: result.list }));
      } else if (activeMenu === '고객 관리') {
        const res = await fetch(`${baseUrl}/customers?search=${search}`);
        const result = await res.json();
        if (result.success) setData(p => ({ ...p, customers: result.list }));
      }
    } catch (e) { console.error("Load Failed"); }
  };

  // 실시간 모니터링 (2초 간격)
  useEffect(() => {
    const fetchMonitor = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/admin/monitor-data');
        const result = await res.json();
        if (result.success) setSysStats({ cpu: result.cpu, mem: result.mem, errCount: result.errCount, logs: result.logs });
      } catch (e) { console.error("Monitor Failed"); }
    };
    fetchMonitor();
    const timer = setInterval(fetchMonitor, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { loadData(); }, [activeMenu, filter, search]);

  // 상태 업데이트 함수 (이 부분이 배정 버튼 등과 연결됨)
  const changeStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await loadData(); // 업데이트 성공 시 목록 새로고침
      }
    } catch (e) { console.error("Update Failed"); }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* 사이드바 */}
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

      {/* 메인 콘텐츠 */}
      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b px-10 flex items-center justify-between shadow-sm z-10 font-bold">
          <div className="relative w-96">
            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
            <input type="text" placeholder={`${activeMenu} 내 검색...`} value={search} onChange={(e) => setSearch(e.target.value)} 
              className="w-full bg-slate-100 pl-12 pr-4 py-2.5 rounded-2xl outline-none focus:ring-2 ring-indigo-500/20" />
          </div>
          <div className="text-sm">오늘 접수: <span className="text-indigo-600 font-black">{data.reservations.length}건</span></div>
        </header>

        <div className="p-10 overflow-y-auto">
          {activeMenu === '예약 관리' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">Reservations</h2>
                <div className="flex bg-slate-200 p-1 rounded-xl gap-1">
                  {['ALL', 'PENDING', 'ASSIGNED', 'REPAIRING', 'COMPLETED'].map(s => (
                    <button key={s} onClick={() => setFilter(s)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filter === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4">
                {data.reservations.map((item: any) => (
                  <div key={item.id} className="bg-white p-6 rounded-[35px] border flex justify-between items-center shadow-sm hover:scale-[1.01] transition-all">
                    <div className="flex gap-6 items-center text-left">
                      <div className={`p-4 rounded-2xl ${item.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'}`}>
                        {item.status === 'COMPLETED' ? <CheckCircle2 size={24}/> : (item.status === 'ASSIGNED' ? <Truck size={24}/> : <Wrench size={24}/>)}
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.res_number}</p>
                        <h3 className="text-xl font-black italic text-slate-800">{item.customer_name} 님</h3>
                        <p className="text-sm text-slate-500 font-bold">{item.issue_type} | {item.address}</p>
                      </div>
                    </div>
                    {/* 버튼 영역: onClick 핸들러 확인 필수 */}
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
              <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden text-left">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 font-black text-[11px] uppercase tracking-widest text-slate-400">
                    <tr><th className="p-6">고객 / 연락처</th><th className="p-6">주소</th><th className="p-6 text-center">방문 횟수</th><th className="p-6 text-right">관리</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.customers.map((cust: any, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="p-6 font-black italic"><p className="text-lg text-slate-800">{cust.customer_name} 님</p><p className="text-xs text-slate-400">{cust.phone_number}</p></td>
                        <td className="p-6 text-sm text-slate-500 font-bold max-w-[250px] truncate">{cust.address || "정보 없음"}</td>
                        <td className="p-6 text-center"><span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black">{cust.visit_count}회</span></td>
                        <td className="p-6 text-right">
                          <button onClick={() => {setSearch(cust.customer_name); setActiveMenu('예약 관리');}} className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl text-xs font-black italic flex items-center gap-2 ml-auto transition">
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

          {activeMenu === '시스템 모니터링' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase font-black">Infra Status</h2>
              <div className="grid grid-cols-3 gap-8 font-black">
                <StatCard label="CPU Usage" val={sysStats.cpu} color="bg-[#10b981]" />
                <StatCard label="Memory" val={sysStats.mem} color="bg-[#6366f1]" />
                <StatCard label="Error Logs" val={String(sysStats.errCount)} color="bg-[#f43f5e]" />
              </div>
              <div className="bg-white rounded-[40px] p-10 border shadow-sm space-y-6 text-left">
                <h3 className="text-xl font-black italic flex items-center gap-2"><AlertCircle className="text-rose-500" size={24}/> Recent Error Messages</h3>
                <div className="space-y-3">
                  {sysStats.logs.length > 0 ? sysStats.logs.map((log: any) => (
                    <div key={log.id} className="bg-rose-50 p-5 rounded-2xl flex justify-between items-center border border-rose-100">
                      <span className="text-rose-700 font-bold text-sm italic uppercase tracking-tight">{log.message}</span>
                      <span className="text-slate-400 text-xs font-mono">{log.time}</span>
                    </div>
                  )) : (
                    <div className="py-10 text-center text-slate-300 font-black italic border-2 border-dashed rounded-3xl">System Status: Stable (0 Errors)</div>
                  )}
                </div>
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
    <div className={`${color} p-10 rounded-[45px] text-white shadow-2xl relative overflow-hidden text-left`}>
      <p className="text-xs font-black opacity-70 uppercase tracking-widest">{label}</p>
      <p className="text-5xl font-black mt-3 italic tracking-tighter">{val}</p>
    </div>
  );
}