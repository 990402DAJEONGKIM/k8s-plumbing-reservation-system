"use client";
import { useState, useEffect } from 'react';
import { 
  ClipboardList, Calendar, Users, Activity, Settings, 
  Search, HeartPulse, CheckCircle2, Truck, Wrench, History, 
  AlertCircle, Download, Bell, BellOff, Server, Megaphone, Edit, Trash2
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState('시스템 모니터링');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState({ reservations: [], customers: [], announcements: [] });
  const [sysStats, setSysStats] = useState({ cpu: '0%', mem: '0%', errCount: 0, logs: [] });
  // 설정 상태
  const [config, setConfig] = useState({ isMaintenance: false, notificationEnabled: true });
  const [adminUsername, setAdminUsername] = useState('');
  
  // 공지사항 관리 상태
  const [currentAnnounce, setCurrentAnnounce] = useState<{ id: number | null; title: string; content: string; }>({ id: null, title: '', content: '' });

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
      } else if (activeMenu === '설정') {
        const res = await fetch(`${baseUrl}/settings`);
        const result = await res.json();
        if (result.success) setConfig({ isMaintenance: result.isMaintenance, notificationEnabled: result.notificationEnabled });
        
        const accountRes = await fetch(`${baseUrl}/account`);
        const accountResult = await accountRes.json();
        if (accountResult.success) setAdminUsername(accountResult.username);
      } else if (activeMenu === '공지사항 관리') {
        const res = await fetch(`${baseUrl}/announcements`);
        const result = await res.json();
        if (result.success) setData(p => ({ ...p, announcements: result.list }));
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

  const changeStatus = async (id: number, status: string) => {
    try {
      await fetch(`http://localhost:4000/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadData();
    } catch (e) { console.error("Update Failed"); }
  };

  // 설정 제어 함수
  const toggleConfig = async (type: string) => {
    try {
      const res = await fetch('http://localhost:4000/api/admin/settings/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const result = await res.json();
      if (result.success) setConfig({ isMaintenance: result.isMaintenance, notificationEnabled: result.notificationEnabled });
    } catch (e) { console.error("Toggle Failed"); }
  };

  const handleAccountUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword') as string;
    const newUsername = formData.get('newUsername') as string;
    const newPassword = formData.get('newPassword') as string;

    if (!currentPassword) {
      alert('현재 비밀번호를 입력해주세요.');
      return;
    }

    try {
      const res = await fetch('http://localhost:4000/api/admin/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newUsername, newPassword })
      });

      const result = await res.json();
      if (res.ok) {
        alert('계정 정보가 성공적으로 변경되었습니다.');
        loadData(); // 사용자 이름 등 최신 정보 다시 로드
        e.currentTarget.reset();
      } else {
        alert(`오류: ${result.message}`);
      }
    } catch (err) {
      alert('계정 정보 변경 중 오류가 발생했습니다.');
    }
  };

  const handleAnnounceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { id, title, content } = currentAnnounce;
    const url = id ? `http://localhost:4000/api/admin/announcements/${id}` : 'http://localhost:4000/api/admin/announcements';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      if (res.ok) {
        alert(`공지사항이 성공적으로 ${id ? '수정' : '등록'}되었습니다.`);
        loadData();
        setCurrentAnnounce({ id: null, title: '', content: '' });
      } else {
        const result = await res.json();
        alert(`오류: ${result.message}`);
      }
    } catch (err) {
      alert('공지사항 처리 중 오류가 발생했습니다.');
    }
  };

  const deleteAnnounce = async (id: number) => {
    if (confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      try {
        const res = await fetch(`http://localhost:4000/api/admin/announcements/${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert('공지사항이 삭제되었습니다.');
          loadData();
        } else {
          alert('삭제 실패');
        }
      } catch (err) {
        alert('삭제 처리 중 오류가 발생했습니다.');
      }
    }
  };


  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <aside className="w-72 bg-[#1a1f2e] text-white flex flex-col p-6 shrink-0 shadow-2xl">
        <div className="flex items-center gap-3 mb-10 p-2 font-black italic text-xl">
          <HeartPulse className="text-indigo-500" size={28} /> Plumbing Admin
        </div>
        <nav className="space-y-1.5 flex-grow">
          {['예약 관리', '일정 조회', '고객 관리', '공지사항 관리', '시스템 모니터링', '설정'].map((menu) => (
            <button key={menu} onClick={() => {setActiveMenu(menu); setSearch('');}} 
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[20px] font-bold transition-all ${activeMenu === menu ? 'bg-indigo-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
              {menu === '예약 관리' && <ClipboardList size={20}/>}
              {menu === '일정 조회' && <Calendar size={20}/>}
              {menu === '고객 관리' && <Users size={20}/>}
              {menu === '공지사항 관리' && <Megaphone size={20}/>}
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
              className="w-full bg-slate-100 pl-12 pr-4 py-2.5 rounded-2xl outline-none" />
          </div>
          <div className="flex items-center gap-4">
            {config.isMaintenance && <span className="flex items-center gap-2 text-xs text-rose-500 animate-pulse"><Server size={14}/> 점검 모드 활성화 중</span>}
            <div className="text-sm">Admin: <span className="font-black text-indigo-600">{adminUsername}</span></div>
            <div className="text-sm">데이터 연동: <span className="text-indigo-600 font-black italic">Connected</span></div>
          </div>
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
               <table className="w-full text-left font-black italic">
                 <thead className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase text-slate-400 tracking-widest">
                   <tr><th className="p-6 font-black">고객 / 연락처</th><th className="p-6 font-black">주소</th><th className="p-6 text-center font-black">방문 횟수</th><th className="p-6 text-right font-black">관리</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {data.customers.map((cust: any, idx) => (
                     <tr key={idx} className="hover:bg-slate-50 transition">
                       <td className="p-6 font-black italic"><p className="text-lg text-slate-800">{cust.customer_name} 님</p><p className="text-xs text-slate-400">{cust.phone_number}</p></td>
                       <td className="p-6 text-sm text-slate-500 font-bold max-w-[250px] truncate">{cust.address || "정보 없음"}</td>
                       <td className="p-6 text-center"><span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black">{cust.visit_count}회</span></td>
                       <td className="p-6 text-right"><button onClick={() => {setSearch(cust.customer_name); setActiveMenu('예약 관리');}} className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl text-xs font-black italic flex items-center gap-2 ml-auto transition"><History size={14}/> 히스토리</button></td>
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
                <h3 className="text-xl font-black italic flex items-center gap-2 font-black italic"><AlertCircle className="text-rose-500" size={24}/> Recent Error Messages</h3>
                <div className="space-y-3 font-bold italic">
                  {sysStats.logs.length > 0 ? sysStats.logs.map((log: any) => (
                    <div key={log.id} className="bg-rose-50 p-5 rounded-2xl flex justify-between items-center border border-rose-100">
                      <span className="text-rose-700 font-black text-sm uppercase tracking-tight">{log.message}</span>
                      <span className="text-slate-400 text-xs font-mono">{log.time}</span>
                    </div>
                  )) : (
                    <div className="py-10 text-center text-slate-300 font-black italic border-2 border-dashed rounded-3xl uppercase tracking-tighter">System Status: Stable (0 Errors)</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeMenu === '설정' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase font-black">Admin Settings</h2>
              <div className="grid gap-6">
                {/* 1. 서버 점검 모드 */}
                <div className="bg-white p-8 rounded-[40px] border shadow-sm flex justify-between items-center font-black italic">
                  <div className="text-left">
                    <h3 className="text-xl flex items-center gap-2 uppercase tracking-tighter">Server Maintenance Mode</h3>
                    <p className="text-sm text-slate-400 font-bold not-italic mt-1">활성화 시 고객 페이지에 점검 안내가 표시됩니다.</p>
                  </div>
                  <button 
                    onClick={() => toggleConfig('maintenance')} 
                    className={`w-16 h-8 rounded-full transition-all relative ${config.isMaintenance ? 'bg-rose-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${config.isMaintenance ? 'left-9' : 'left-1'}`}></div>
                  </button>
                </div>

                {/* 2. 실시간 알림 */}
                <div className="bg-white p-8 rounded-[40px] border shadow-sm flex justify-between items-center font-black italic">
                  <div className="text-left">
                    <h3 className="text-xl flex items-center gap-2 uppercase tracking-tighter">Real-time Notifications</h3>
                    <p className="text-sm text-slate-400 font-bold not-italic mt-1">시스템 장애 및 신규 예약 시 푸시 알림을 수신합니다.</p>
                  </div>
                  <button 
                    onClick={() => toggleConfig('notification')} 
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${config.notificationEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {config.notificationEnabled ? <Bell size={24}/> : <BellOff size={24}/>}
                  </button>
                </div>

                {/* 3. 데이터 백업 */}
                <div className="bg-white p-8 rounded-[40px] border shadow-sm flex justify-between items-center font-black italic">
                  <div className="text-left">
                    <h3 className="text-xl flex items-center gap-2 uppercase tracking-tighter">Database Snapshot Backup</h3>
                    <p className="text-sm text-slate-400 font-bold not-italic mt-1">현재 데이터베이스의 전체 상태를 SQL 파일로 다운로드합니다.</p>
                  </div>
                  <button 
                    onClick={() => window.location.href = 'http://localhost:4000/api/admin/backup/download'}
                    className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl hover:bg-indigo-600 transition-all uppercase text-xs"
                  >
                    <Download size={18}/> Download SQL
                  </button>
                </div>
                
                {/* 4. 관리자 계정 설정 */}
                <div className="bg-white p-8 rounded-[40px] border shadow-sm text-left font-black italic">
                  <h3 className="text-xl flex items-center gap-2 uppercase tracking-tighter">Admin Account Settings</h3>
                  <p className="text-sm text-slate-400 font-bold not-italic mt-1 mb-6">관리자 아이디와 비밀번호를 변경합니다.</p>
                  <form onSubmit={handleAccountUpdate} className="space-y-4">
                    <input type="password" name="currentPassword" placeholder="현재 비밀번호" required className="w-full bg-slate-100 p-4 rounded-2xl outline-none not-italic" />
                    <input type="text" name="newUsername" placeholder="새 아이디 (변경 시 입력)" className="w-full bg-slate-100 p-4 rounded-2xl outline-none not-italic" />
                    <input type="password" name="newPassword" placeholder="새 비밀번호 (변경 시 입력)" className="w-full bg-slate-100 p-4 rounded-2xl outline-none not-italic" />
                    <button type="submit" className="bg-indigo-600 text-white px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-all uppercase text-xs">
                      계정 정보 변경
                    </button>
                  </form>
                </div>

              </div>
            </div>
          )}

          {activeMenu === '공지사항 관리' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase font-black">Announcements</h2>
              
              {/* 공지사항 등록/수정 폼 */}
              <div className="bg-white p-8 rounded-[40px] border shadow-sm text-left font-black italic">
                <h3 className="text-xl flex items-center gap-2 uppercase tracking-tighter">
                  {currentAnnounce.id ? 'Edit Announcement' : 'Create New Announcement'}
                </h3>
                <form onSubmit={handleAnnounceSubmit} className="space-y-4 mt-6 not-italic">
                  <input 
                    type="text" 
                    placeholder="제목" 
                    value={currentAnnounce.title}
                    onChange={e => setCurrentAnnounce(p => ({ ...p, title: e.target.value }))}
                    required 
                    className="w-full bg-slate-100 p-4 rounded-2xl outline-none" />
                  <textarea 
                    placeholder="내용" 
                    value={currentAnnounce.content}
                    onChange={e => setCurrentAnnounce(p => ({ ...p, content: e.target.value }))}
                    required 
                    rows={4}
                    className="w-full bg-slate-100 p-4 rounded-2xl outline-none" />
                  <div className="flex gap-2">
                    <button type="submit" className="bg-indigo-600 text-white px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-all uppercase text-xs">
                      {currentAnnounce.id ? '수정하기' : '등록하기'}
                    </button>
                    {currentAnnounce.id && (
                      <button type="button" onClick={() => setCurrentAnnounce({ id: null, title: '', content: '' })} className="bg-slate-200 text-slate-600 px-8 py-4 rounded-2xl hover:bg-slate-300 transition-all uppercase text-xs">
                        취소
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* 공지사항 목록 */}
              <div className="space-y-4">
                {data.announcements.map((item: any) => (
                  <div key={item.id} className="bg-white p-6 rounded-[35px] border flex justify-between items-center shadow-sm text-left">
                    <div>
                      <h3 className="text-xl font-black italic text-slate-800">{item.title}</h3>
                      <p className="text-sm text-slate-500 font-bold mt-1">{item.content}</p>
                      <p className="text-xs text-slate-400 font-mono mt-2">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setCurrentAnnounce(item)} className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-indigo-600 hover:text-white transition"><Edit size={16}/></button>
                      <button onClick={() => deleteAnnounce(item.id)} className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-rose-500 hover:text-white transition"><Trash2 size={16}/></button>
                    </div>
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
    <div className={`${color} p-10 rounded-[45px] text-white shadow-2xl relative overflow-hidden text-left`}>
      <p className="text-xs font-black opacity-70 uppercase tracking-widest">{label}</p>
      <p className="text-5xl font-black mt-3 italic tracking-tighter">{val}</p>
    </div>
  );
}