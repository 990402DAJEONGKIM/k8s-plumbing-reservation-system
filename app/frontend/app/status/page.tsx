"use client";
import { useState } from 'react';
import { Search, Clock, Phone, Wrench, CheckCircle2, PackageCheck } from 'lucide-react';

export default function StatusPage() {
  const [resNumber, setResNumber] = useState('');
  const [data, setData] = useState<any>(null);

  const onSearch = async () => {
    if (!resNumber) return;
    try {
      const res = await fetch(`http://localhost:4000/api/v1/reservations/${resNumber.trim()}`);
      const result = await res.json();
      if (res.ok && result.success) {
        setData(result.data);
      } else {
        alert(result.message);
        setData(null);
      }
    } catch (err) {
      alert("서버 연결 실패");
    }
  };

  const steps = [
    { label: '접수', val: 'PENDING', icon: <Clock /> },
    { label: '배정', val: 'ASSIGNED', icon: <Phone /> },
    { label: '수리중', val: 'REPAIRING', icon: <Wrench /> },
    { label: '완료', val: 'COMPLETED', icon: <PackageCheck /> },
  ];
  
  // 대소문자 방어 코드: DB값이 소문자든 대문자든 대문자로 변환해서 비교
  const currentStatus = (data?.status || 'PENDING').toUpperCase();
  const current = steps.findIndex(s => s.val === currentStatus);

  return (
    <div className="min-h-screen bg-[#2b1c6d] py-20 px-4 text-white font-sans">
      <div className="max-w-4xl mx-auto space-y-12 text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-lg">Track <span className="text-red-500">Service</span></h1>
        
        <div className="flex bg-white p-2 rounded-sm border-b-8 border-red-600 shadow-2xl">
          <input 
            type="text" 
            className="flex-grow p-4 text-black text-2xl font-black outline-none" 
            placeholder="RES- 번호 입력" 
            value={resNumber}
            onChange={e => setResNumber(e.target.value)}
          />
          <button onClick={onSearch} className="bg-red-600 p-4 hover:bg-red-700 transition"><Search size={32} /></button>
        </div>

        {data && (
          <div className="bg-white p-12 shadow-2xl rounded-sm animate-in fade-in duration-500 text-left text-black">
            {/* 진행 상태 그래프 */}
            <div className="relative flex justify-between items-center mb-20 px-4">
              <div className="absolute w-[90%] h-1 bg-gray-200 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
              <div 
                className="absolute h-1 bg-red-600 top-1/2 left-[5%] -translate-y-1/2 transition-all duration-1000" 
                style={{ width: `${(current / 3) * 90}%` }}
              ></div>
              
              {steps.map((s, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 ${
                    i <= current ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-200 text-gray-300'
                  }`}>
                    {i < current ? <CheckCircle2 size={24} /> : s.icon}
                  </div>
                  <span className={`absolute -bottom-8 font-black text-xs uppercase whitespace-nowrap ${
                    i <= current ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* 상세 정보 레이아웃 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t pt-10 font-black italic">
              <div className="space-y-3">
                <p className="text-[10px] text-red-600 uppercase border-l-4 border-red-600 pl-2 font-black">Customer Detail</p>
                <p className="text-4xl text-[#2b1c6d]">{data.customer_name} 님</p>
                <p className="text-gray-500 not-italic font-bold">{data.address} | {data.phone_number}</p>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] text-red-600 uppercase border-l-4 border-red-600 pl-2 font-black">Service Status</p>
                <p className="text-4xl text-red-600 uppercase">{data.issue_type || '배관 점검'}</p>
                <p className="text-gray-500 not-italic font-bold tracking-tighter">접수일: {new Date(data.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}