"use client";
import { useState, useEffect } from 'react';
import { 
  ClipboardList, Calendar, Users, Activity, Settings, 
  Search, HeartPulse, CheckCircle2, Truck, Wrench, History, X,
  AlertCircle, Download, Bell, BellOff, Server, Megaphone, Edit, Trash2,
  Database, Cloud, Globe, ShieldCheck
} from 'lucide-react';
import { fetcher } from '../../lib/api';

export default function AdminDashboard() {
  // 💡 Cloud-Native: 하드코딩된 로컬 주소 대신 환경변수 사용 (기본값 fallback 처리)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

  // 로그인 상태 관리
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [activeMenu, setActiveMenu] = useState('시스템 모니터링');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState({ reservations: [], customers: [], announcements: [], calendar: [] });
  const [sysStats, setSysStats] = useState<any>({ metrics: null, nodeDetails: [], haStatus: [], errCount: 0, logs: [] });
  // 설정 상태
  const [config, setConfig] = useState({ isMaintenance: false, notificationEnabled: true });
  const [adminUsername, setAdminUsername] = useState('');
  
  // 공지사항 관리 상태
  const [currentAnnounce, setCurrentAnnounce] = useState<{ id: number | null; title: string; content: string; }>({ id: null, title: '', content: '' });

  // 달력 상태
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateReservations, setSelectedDateReservations] = useState<any[]>([]);

  // 로그인 유지 체크 (새로고침 방어)
  useEffect(() => {
    if (localStorage.getItem('admin_logged_in') === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  // 로그인 요청 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem('admin_logged_in', 'true');
        setIsLoggedIn(true);
      } else {
        alert(result.message || '로그인에 실패했습니다.');
      }
    } catch (e) {
      alert('로그인 요청 중 오류가 발생했습니다.');
    }
  };

  // 데이터 로딩
  const loadData = async () => {
    try {
      const ts = Date.now(); // 💡 브라우저 캐시 우회를 위한 타임스탬프
      if (activeMenu === '예약 관리') {
        const result = await fetcher(`/api/admin/reservations?status=${filter}&search=${encodeURIComponent(search)}&admin=true&_t=${ts}`);
        if (result.success) setData(p => ({ ...p, reservations: result.list }));
      } else if (activeMenu === '고객 관리') {
        const result = await fetcher(`/api/admin/customers?search=${encodeURIComponent(search)}&admin=true&_t=${ts}`);
        if (result.success) setData(p => ({ ...p, customers: result.list }));
      } else if (activeMenu === '일정 조회') {
        const result = await fetcher(`/api/admin/calendar?admin=true&_t=${ts}`);
        if (result.success) setData(p => ({ ...p, calendar: result.list }));
      } else if (activeMenu === '설정') {
        const result = await fetcher(`/api/admin/settings`);
        if (result.success) setConfig({ isMaintenance: result.isMaintenance, notificationEnabled: result.notificationEnabled });
        
        const accountResult = await fetcher(`/api/admin/account?admin=true&_t=${ts}`);
        if (accountResult.success) setAdminUsername(accountResult.username);
      } else if (activeMenu === '공지사항 관리') {
        const result = await fetcher(`/api/admin/announcements?admin=true&_t=${ts}`);
        if (result.success) setData(p => ({ ...p, announcements: result.list }));
      }
    } catch (e) { console.error("Load Failed"); }
  };

  // 달력 날짜 클릭 시 상세 데이터 불러오기
  const handleDateClick = async (dateStr: string) => {
    setSelectedDate(dateStr);
    try {
      // 💡 fetcher 대신 완벽하게 캐시를 우회하는 네이티브 fetch 사용
      const res = await fetch(`${API_BASE_URL}/api/admin/reservations?status=ALL&search=${encodeURIComponent(dateStr)}&admin=true&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache' }
      });
      const result = await res.json();
      if (result.success) setSelectedDateReservations(result.list);
    } catch (e) { console.error("Load Detail Failed"); }
  };

  // 실시간 모니터링 (2초 간격)
  useEffect(() => {
    if (!isLoggedIn) return; // 로그인 전에는 모니터링 중지
    const fetchMonitor = async () => {
      try {
        const result = await fetcher(`/api/admin/monitor-data?_t=${Date.now()}`);
        if (result.success) setSysStats({ metrics: result.metrics, nodeDetails: result.nodeDetails, haStatus: result.haStatus, errCount: result.errCount, logs: result.logs });
      } catch (e) { console.error("Monitor Failed"); }
    };
    fetchMonitor();
    const timer = setInterval(fetchMonitor, 2000);
    return () => clearInterval(timer);
  }, [isLoggedIn]);

  useEffect(() => { 
    if (isLoggedIn) loadData(); 
  }, [activeMenu, filter, search, isLoggedIn]);

  const changeStatus = async (id: number, status: string) => {
    try {
      await fetcher(`/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadData();
    } catch (e: any) { 
      alert(`상태 변경 실패: ${e?.info?.message || e.message}`);
      console.error("Update Failed", e); 
    }
  };

  // 설정 제어 함수
  const toggleConfig = async (type: string) => {
    try {
      const result = await fetcher('/api/admin/settings/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
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
      const result = await fetcher('/api/admin/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newUsername, newPassword })
      });

      if (result) {
        alert('계정 정보가 성공적으로 변경되었습니다.');
        loadData(); // 사용자 이름 등 최신 정보 다시 로드
        e.currentTarget.reset();
      }
    } catch (err: any) {
      alert(`오류: ${err?.info?.message || err.message}`);
    }
  };

  const handleAnnounceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { id, title, content } = currentAnnounce;
    const url = id ? `/api/admin/announcements/${id}` : '/api/admin/announcements';
    const method = id ? 'PUT' : 'POST';

    try {
      await fetcher(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      alert(`공지사항이 성공적으로 ${id ? '수정' : '등록'}되었습니다.`);
      loadData();
      setCurrentAnnounce({ id: null, title: '', content: '' });
    } catch (err: any) {
      alert(`오류: ${err?.info?.message || err.message}`);
    }
  };

  const deleteAnnounce = async (id: number) => {
    if (confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      try {
        await fetcher(`/api/admin/announcements/${id}`, { method: 'DELETE' });
        alert('공지사항이 삭제되었습니다.');
        loadData();
      } catch (err) {
        alert(`삭제 처리 중 오류가 발생했습니다. (${err?.info?.message || err.message})`);
      }
    }
  };

  // 로그인 되지 않은 상태일 때 보여줄 화면 (로그인 폼)
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
        {/* 배경 장식 (은은한 그라데이션 빛) */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-500/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="bg-white/70 backdrop-blur-2xl p-12 rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white w-[420px] text-center relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="mx-auto bg-gradient-to-tr from-indigo-600 to-violet-500 w-20 h-20 rounded-[24px] flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-8 transform -rotate-3 hover:rotate-0 transition-all duration-300">
            <HeartPulse className="text-white" size={40} />
          </div>
          
          <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2 text-slate-800">Welcome Back</h1>
          <p className="text-slate-500 text-sm font-bold mb-10">엉클 배관 관리자 시스템에 로그인하세요</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="text-left">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-2">Admin ID</label>
              <input 
                type="text" 
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-white/50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 transition-all focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" 
                required 
              />
            </div>
            <div className="text-left">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-2">Password</label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-white/50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 transition-all focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" 
                required 
              />
            </div>
            <div className="pt-2">
              <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all duration-300">
                Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

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
            <button onClick={() => { localStorage.removeItem('admin_logged_in'); setIsLoggedIn(false); }} className="text-xs bg-slate-100 hover:bg-rose-100 hover:text-rose-600 px-4 py-2 rounded-xl font-black transition">
              로그아웃
            </button>
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
               {data.reservations.map((item: any, idx: number) => {
                 const isPast = item.reservation_datetime && new Date(item.reservation_datetime).getTime() < new Date().setHours(0, 0, 0, 0);
                 const isDelayed = isPast && item.status !== 'COMPLETED';
                 return (
                <div key={`main-res-${idx}-${item.res_number}`} className={`p-6 rounded-[35px] border flex justify-between items-center shadow-sm hover:scale-[1.01] transition-all ${isDelayed ? 'bg-rose-50 border-rose-200' : 'bg-white'}`}>
                   <div className="flex gap-6 items-center text-left">
                     <div className={`p-4 rounded-2xl ${item.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'}`}>
                       {item.status === 'COMPLETED' ? <CheckCircle2 size={24}/> : (item.status === 'ASSIGNED' ? <Truck size={24}/> : <Wrench size={24}/>)}
                     </div>
                     <div>
                       <div className="flex items-center gap-2 mb-1">
                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.res_number}</p>
                         {item.reservation_datetime && (
                           <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-black tracking-widest">
                             예약일: {new Date(item.reservation_datetime).toLocaleDateString()}
                           </span>
                         )}
                       </div>
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
                 );
               })}
             </div>
           </div>
          )}

          {activeMenu === '일정 조회' && (
            <div className="flex gap-6 items-start animate-in fade-in relative">
              <div className={`transition-all duration-500 ease-in-out ${selectedDate ? 'w-2/3' : 'w-full'} space-y-6`}>
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">Calendar</h2>
                <div className="flex items-center gap-3">
                  {/* 💡 예약이 있는 달로 바로 이동하는 편의 기능 추가 */}
                  {data.calendar && data.calendar.length > 0 && (
                    <select 
                      onChange={(e) => e.target.value && setCurrentDate(new Date(`${e.target.value}-01`))}
                      className="bg-indigo-50 border-none text-sm font-black text-indigo-600 px-4 py-3 rounded-2xl shadow-sm outline-none cursor-pointer"
                    >
                      <option value="">📂 예약된 달 확인하기</option>
                      {Array.from(new Set(data.calendar.map((c: any) => c.date.substring(0, 7)))).sort().map((ym: any) => (
                        <option key={ym} value={ym}>{ym.split('-')[0]}년 {ym.split('-')[1]}월</option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-3xl shadow-sm border font-black text-slate-700">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="hover:text-indigo-600 transition">&lt;</button>
                    <span className="w-32 text-center text-lg">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</span>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="hover:text-indigo-600 transition">&gt;</button>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-8 rounded-[40px] border shadow-sm">
                <div className="grid grid-cols-7 gap-2 text-center mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(wd => (
                    <div key={wd} className="font-black text-slate-400 text-xs uppercase tracking-widest">{wd}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
                    <div key={`blank-${i}`} className="min-h-[120px] bg-slate-50/50 rounded-3xl border border-transparent"></div>
                  ))}
                  {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                    const d = i + 1;
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dayData = data.calendar.find((c: any) => c.date === dateStr);
                    
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const isToday = dateStr === todayStr;
                    
                    return (
                      <div 
                        key={d} 
                        onClick={() => {
                          if (dayData) {
                            handleDateClick(dateStr);
                          }
                        }}
                        className={`min-h-[120px] p-4 rounded-3xl border transition-all flex flex-col relative
                          ${dayData ? 'cursor-pointer hover:border-indigo-500 hover:shadow-lg bg-white border-slate-200' : 'bg-slate-50/50 border-transparent'}
                          ${selectedDate === dateStr ? 'ring-4 ring-indigo-500 ring-offset-2 shadow-xl border-indigo-500 scale-105 z-10' : isToday ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                        `}
                      >
                        <span className={`font-black text-sm mb-2 ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{d}</span>
                        {dayData && (
                          <div className="w-full flex flex-col gap-1.5 mt-auto pt-2">
                            <div className="flex flex-col gap-1">
                              {dayData.details?.split('||').map((detail: string, idx: number) => (
                                <span key={idx} className="bg-indigo-100/70 text-indigo-700 text-[10px] px-1.5 py-1 rounded border border-indigo-200/50 font-bold truncate text-left w-full">
                                  {detail}
                                </span>
                              ))}
                            </div>
                            <div className="w-full bg-indigo-50 text-indigo-600 font-black text-[10px] p-2 rounded-xl flex items-center justify-between">
                              <span>예약</span>
                              <span className="text-sm bg-white px-2 py-0.5 rounded-lg shadow-sm">{dayData.count}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* 사이드 패널 (우측 상세 예약 리스트) */}
            {selectedDate && (
              <div className="w-1/3 bg-white border shadow-xl rounded-[40px] p-6 sticky top-0 flex flex-col animate-in slide-in-from-right-8 duration-500" style={{ height: 'calc(100vh - 120px)' }}>
                <div className="flex justify-between items-center mb-6 px-2">
                  <h3 className="text-2xl font-black italic text-slate-800">
                    <span className="text-indigo-600">{selectedDate.split('-')[2]}일</span> 예약
                  </h3>
                  <button onClick={() => setSelectedDate(null)} className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 rounded-full transition-colors text-slate-400"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 px-2 pb-4 scrollbar-hide">
                  {selectedDateReservations.length > 0 ? selectedDateReservations.map((res, idx) => (
                    <div key={`panel-res-${idx}-${res.res_number}`} className="p-5 rounded-3xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md transition-all text-left">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-black text-indigo-600 bg-indigo-100/50 px-3 py-1 rounded-xl text-sm">
                          {res.reservation_datetime ? new Date(res.reservation_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '시간미정'}
                        </span>
                        <span className={`text-[10px] px-3 py-1 rounded-full font-black tracking-widest uppercase ${res.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : res.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-600' : res.status === 'REPAIRING' ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-600'}`}>{res.status}</span>
                      </div>
                      <p className="font-black text-lg text-slate-800">{res.customer_name} 님</p>
                      <p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-2"><span className="text-indigo-500">{res.issue_type}</span> <span className="text-slate-300">|</span> <span className="truncate">{res.address}</span></p>
                    </div>
                  )) : (
                    <div className="py-20 text-center font-bold text-slate-300 italic border-2 border-dashed rounded-3xl border-slate-200">예약 내역이 없습니다.</div>
                  )}
                </div>
              </div>
            )}
           </div>
          )}

          {activeMenu === '고객 관리' && (
             <div className="space-y-6 animate-in fade-in">
             <h2 className="text-3xl font-black italic tracking-tighter uppercase">Customers</h2>
             <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden text-left">
               <table className="w-full text-left font-black italic">
                 <thead className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase text-slate-400 tracking-widest">
                   <tr><th className="p-6 font-black">고객 / 연락처</th><th className="p-6 font-black">주소</th><th className="p-6 text-center font-black">최근 예약일</th><th className="p-6 text-center font-black">방문 횟수</th><th className="p-6 text-right font-black">관리</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {data.customers.map((cust: any, idx) => (
                     <tr key={idx} className="hover:bg-slate-50 transition">
                       <td className="p-6 font-black italic"><p className="text-lg text-slate-800">{cust.customer_name} 님 {cust.visit_count >= 3 && <span title="단골 고객">⭐</span>}</p><p className="text-xs text-slate-400">{cust.phone_number}</p></td>
                       <td className="p-6 text-sm text-slate-500 font-bold max-w-[250px] truncate">{cust.address || "정보 없음"}</td>
                       <td className="p-6 text-center text-sm text-slate-500 font-bold">{cust.last_visit_date ? new Date(cust.last_visit_date).toLocaleDateString() : '-'}</td>
                       <td className="p-6 text-center"><span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black">{cust.visit_count}회</span></td>
                      <td className="p-6 text-right"><button onClick={() => {setSearch(cust.customer_name); setFilter('ALL'); setActiveMenu('예약 관리');}} className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl text-xs font-black italic flex items-center gap-2 ml-auto transition"><History size={14}/> 히스토리</button></td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
          )}

          {activeMenu === '시스템 모니터링' && (
            <div className="space-y-10 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase font-black">Infra Status</h2>
                <button onClick={() => {
                   const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL || `http://${window.location.hostname}:30000`;
                   window.open(grafanaUrl, '_blank');
                }} 
                   className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl hover:bg-orange-500 transition-all font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-orange-500/30">
                  <Activity size={18} />
                  Deep Dive in Grafana
                </button>
              </div>
              
              {sysStats.metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-black text-left">
                  {/* 1. 인프라 하드웨어 (Node Exporter) */}
                  <div className="bg-white p-6 rounded-[30px] border shadow-sm flex flex-col gap-4 transition-all hover:shadow-lg">
                    <div className="flex items-center gap-2 text-indigo-600"><Server size={24}/> <span className="text-lg italic uppercase tracking-tighter">Infrastructure</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>CPU / Mem</span><span className="text-indigo-600">{sysStats.metrics.infra.cpu} / {sysStats.metrics.infra.mem}</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>Disk / Net</span><span className="text-indigo-600">{sysStats.metrics.infra.disk} / {sysStats.metrics.infra.network}</span></div>
                  </div>

                  {/* 2. 쿠버네티스 (Kube-State-Metrics) */}
                  <div className="bg-white p-6 rounded-[30px] border shadow-sm flex flex-col gap-4 transition-all hover:shadow-lg">
                    <div className="flex items-center gap-2 text-blue-500"><Cloud size={24}/> <span className="text-lg italic uppercase tracking-tighter">Kubernetes</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>Pod Health</span><span className="text-blue-500">{sysStats.metrics.kubernetes.podHealth}</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>Nodes Available</span><span className="text-blue-500">{sysStats.metrics.kubernetes.nodeAvailable}</span></div>
                  </div>

                  {/* 3. 데이터베이스 (MySQL Exporter) */}
                  <div className="bg-white p-6 rounded-[30px] border shadow-sm flex flex-col gap-4 transition-all hover:shadow-lg">
                    <div className="flex items-center gap-2 text-emerald-500"><Database size={24}/> <span className="text-lg italic uppercase tracking-tighter">MySQL (Prometheus)</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>QPS / Conn</span><span className="text-emerald-500">{sysStats.metrics.database.qps} / {sysStats.metrics.database.connections}</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>Slow / Rep. Lag</span><span className="text-emerald-500">{sysStats.metrics.database.slowQueries} / {sysStats.metrics.database.replicationLag}</span></div>
                  </div>

                  {/* 4. 로그인/진입점 (Keepalived Exporter) */}
                  <div className="bg-white p-6 rounded-[30px] border shadow-sm flex flex-col gap-4 transition-all hover:shadow-lg">
                    <div className="flex items-center gap-2 text-amber-500"><ShieldCheck size={24}/> <span className="text-lg italic uppercase tracking-tighter">VIP Entrypoint</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>VIP Status</span><span className="text-amber-500">{sysStats.metrics.login.vipStatus}</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>Uptime</span><span className="text-amber-500">{sysStats.metrics.login.uptime}</span></div>
                  </div>

                  {/* 5. 웹 접속/응답 (Blackbox Exporter) */}
                  <div className="bg-white p-6 rounded-[30px] border shadow-sm flex flex-col gap-4 transition-all hover:shadow-lg">
                    <div className="flex items-center gap-2 text-rose-500"><Globe size={24}/> <span className="text-lg italic uppercase tracking-tighter">Web / Ingress</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>Latency</span><span className="text-rose-500">{sysStats.metrics.web.latency}</span></div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-600 flex justify-between"><span>HTTP Status</span><span className="text-rose-500">{sysStats.metrics.web.httpStatus}</span></div>
                  </div>

                  {/* 기존 에러 로그 카드 */}
                  <div className="bg-[#f43f5e] p-6 rounded-[30px] shadow-sm flex flex-col gap-4 text-white justify-center transition-all hover:shadow-lg hover:scale-[1.02]">
                    <div className="flex items-center justify-between text-white/80"><span className="text-lg italic uppercase tracking-tighter">Error Logs</span> <AlertCircle size={24}/></div>
                    <div className="text-5xl font-black italic tracking-tighter">{sysStats.errCount}</div>
                  </div>
                </div>
              )}

              {/* 💡 [추가] 노드별 상세 상태 테이블 (Top-Down 접근법 적용) */}
              {sysStats.nodeDetails && sysStats.nodeDetails.length > 0 && (
                <div className="bg-white rounded-[40px] p-10 border shadow-sm space-y-6 text-left overflow-hidden">
                  <h3 className="text-xl font-black italic flex items-center gap-2 font-black italic uppercase tracking-tighter"><Server className="text-indigo-600" size={24}/> Node Status</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-black italic">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase text-slate-400 tracking-widest">
                        <tr>
                          <th className="p-4 font-black">Node Name</th>
                          <th className="p-4 font-black">Status</th>
                          <th className="p-4 font-black">CPU Usage</th>
                          <th className="p-4 font-black">Memory Usage</th>
                          <th className="p-4 font-black">Disk Usage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sysStats.nodeDetails.map((node: any, idx: number) => {
                          const isWarn = parseFloat(node.cpu) > 80 || parseFloat(node.mem) > 80;
                          // 💡 외부 노드인지 판별 (백엔드에서 넘겨준 isExternal 플래그 사용)
                          const isExternal = node.isExternal;
                          return (
                            <tr key={idx} className={`hover:bg-slate-100 transition border-b border-white ${isWarn ? 'bg-rose-50/30' : isExternal ? 'bg-emerald-50/40' : 'bg-blue-50/20'}`}>
                              <td className="p-4 font-black text-slate-800">
                                <div className="flex items-center gap-2">
                                  {isExternal ? <Database className="text-emerald-500" size={16}/> : <Cloud className="text-blue-500" size={16}/>}
                                  <span>{node.name}</span>
                                </div>
                                {node.ip && <div className="mt-1 ml-6 text-[10px] text-slate-400 font-bold tracking-widest bg-slate-100 inline-block px-2 py-0.5 rounded-md">({node.ip})</div>}
                              </td>
                              <td className={`p-4 font-black text-sm ${node.status.includes('Warning') || node.status.includes('Not') ? 'text-rose-500' : isExternal ? 'text-emerald-500' : 'text-blue-500'}`}>{node.status}</td>
                              <td className={`p-4 text-sm ${parseFloat(node.cpu) > 80 ? 'text-rose-500 animate-pulse' : 'text-slate-600'}`}>{node.cpu}</td>
                              <td className={`p-4 text-sm ${parseFloat(node.mem) > 80 ? 'text-rose-500 animate-pulse' : 'text-slate-600'}`}>{node.mem}</td>
                              <td className="p-4 text-sm text-slate-600">{node.disk}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 💡 [추가] Database HA Status (ProxySQL) */}
              {sysStats.haStatus && sysStats.haStatus.length > 0 && (
                <div className="bg-white rounded-[40px] p-10 border shadow-sm space-y-6 text-left overflow-hidden">
                  <h3 className="text-xl font-black italic flex items-center gap-2 font-black italic uppercase tracking-tighter"><Database className="text-emerald-500" size={24}/> Database HA Status (ProxySQL)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-black italic">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase text-slate-400 tracking-widest">
                        <tr>
                          <th className="p-4 font-black">Hostgroup (Role)</th>
                          <th className="p-4 font-black">Hostname (IP)</th>
                          <th className="p-4 font-black">Status / Weight</th>
                          <th className="p-4 font-black">Active Conn</th>
                          <th className="p-4 font-black">Routed Queries</th>
                          <th className="p-4 font-black">Read-Only</th>
                          <th className="p-4 font-black">Replication Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sysStats.haStatus.map((db: any, idx: number) => {
                          const isError = db.status !== 'ONLINE' || db.readOnly === 'Unreachable';
                          return (
                            <tr key={idx} className={`hover:bg-slate-50 transition ${isError ? 'bg-rose-50/30' : ''}`}>
                              <td className="p-4 font-black text-slate-800"><span className={`px-2 py-0.5 rounded-md text-[10px] text-white tracking-widest ${db.group === 10 ? 'bg-indigo-500' : 'bg-emerald-500'}`}>{db.group}</span><span className="ml-2">{db.role}</span></td>
                              <td className="p-4 text-sm text-slate-600 font-mono flex items-center gap-2">
                                {db.ip}
                                {db.status === 'ONLINE' && db.weight > 10 ? (
                                  db.group === 10 
                                    ? <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest bg-rose-100 text-rose-600 border border-rose-200 flex items-center gap-1 animate-pulse">🔥 ACTIVE WRITER</span>
                                    : <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center gap-1">🟢 ACTIVE READER</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest bg-slate-100 text-slate-400 border border-slate-200 flex items-center gap-1">💤 STANDBY</span>
                                )}
                              </td>
                              <td className={`p-4 font-black text-sm ${db.status === 'ONLINE' ? 'text-emerald-500' : 'text-rose-500'}`}>{db.status} <span className="text-slate-400 font-bold">({db.weight})</span></td>
                              <td className="p-4 text-sm font-black text-indigo-600">{db.connUsed ?? 0}</td>
                              <td className="p-4 text-sm font-black text-blue-500">{db.queries?.toLocaleString() ?? 0}</td>
                              <td className={`p-4 text-sm font-black ${db.readOnly === 'OFF' ? 'text-indigo-600' : db.readOnly === 'ON' ? 'text-blue-500' : 'text-rose-500'}`}>{db.readOnly}</td>
                              <td className={`p-4 text-sm font-mono ${db.replStatus?.includes('Unreachable') ? 'text-rose-500' : 'text-slate-600'}`}>{db.replStatus}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
                    onClick={() => window.location.href = `${API_BASE_URL}/api/admin/backup/download`}
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
} );
}