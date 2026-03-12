"use client";
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('ALL');

  // 리스트 불러오기
  const fetchList = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/admin/reservations?status=${filter}`);
      const result = await res.json();
      if (result.success) setList(result.list);
    } catch (err) {
      console.error("데이터 로딩 실패");
    }
  };

  useEffect(() => { fetchList(); }, [filter]);

  // ★ 모든 버튼이 공통으로 사용하는 상태 변경 함수
  const updateStatus = async (id: number, nextStatus: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }), // 대문자로 전달
      });
      
      const result = await res.json();
      if (result.success) {
        fetchList(); // 성공 시 리스트 즉시 갱신
      } else {
        alert("업데이트 실패: " + result.message);
      }
    } catch (err) {
      alert("서버 통신 에러");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-black text-[#2b1c6d] italic uppercase tracking-tighter">Uncle Admin Panel</h1>

        {/* 필터 탭 */}
        <div className="flex gap-2">
          {['ALL', 'PENDING', 'ASSIGNED', 'REPAIRING', 'COMPLETED'].map((s) => (
            <button 
              key={s} 
              onClick={() => setFilter(s)}
              className={`px-5 py-2 text-xs font-black rounded-sm transition-all ${
                filter === s ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-slate-400 border'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 예약 카드 리스트 */}
        <div className="space-y-4">
          {list.map((item: any) => (
            <div key={item.id} className="bg-white p-6 rounded-sm shadow-md border-l-8 border-[#2b1c6d] flex flex-col md:flex-row justify-between items-center gap-6 text-left">
              <div className="flex-grow">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.res_number}</p>
                <h3 className="text-2xl font-black text-[#2b1c6d] italic">
                  {item.customer_name} 님 
                  <span className="ml-3 text-sm font-bold text-red-600">({item.status})</span>
                </h3>
                <p className="text-gray-500 font-bold">{item.address}</p>
                <p className="text-xs font-black text-blue-600 uppercase mt-1">{item.issue_type}</p>
              </div>

              {/* 버튼 세트: 이제 모든 버튼이 동일한 updateStatus 함수를 호출합니다 */}
              <div className="flex gap-2">
                <button 
                  onClick={() => updateStatus(item.id, 'ASSIGNED')}
                  className={`px-4 py-3 text-sm font-black rounded-md transition-all ${
                    item.status === 'ASSIGNED' ? 'bg-blue-700 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  기사배정
                </button>
                <button 
                  onClick={() => updateStatus(item.id, 'REPAIRING')}
                  className={`px-4 py-3 text-sm font-black rounded-md transition-all ${
                    item.status === 'REPAIRING' ? 'bg-orange-700 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  수리중
                </button>
                <button 
                  onClick={() => updateStatus(item.id, 'COMPLETED')}
                  className={`px-4 py-3 text-sm font-black rounded-md transition-all ${
                    item.status === 'COMPLETED' ? 'bg-green-700 text-white' : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  완료
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}