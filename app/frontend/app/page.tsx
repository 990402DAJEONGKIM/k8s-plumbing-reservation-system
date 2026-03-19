"use client";
import { useState, useEffect } from 'react';
import { Phone, Clock, ShieldCheck, Droplets, Wrench, Hammer, Send, Truck, Pipette, Flame, Heart, ChevronRight, Search, Megaphone, X } from 'lucide-react';
import { useAnnouncements } from '../lib/hooks';

export default function Home() {
  const [form, setForm] = useState({ name: '', phone: '', address: '', issueType: '누수/방수', reservation_datetime: '' });
  const [submittedNumber, setSubmittedNumber] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const announcements = useAnnouncements();

  useEffect(() => {
    if (announcements.length > 0) {
      setShowPopup(true);
    }
  }, [announcements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 환경변수가 없으면 빈 문자열('')을 사용하여 상대 경로(/api/...)로 요청하도록 설정
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${API_URL}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) setSubmittedNumber(data.resNumber);
    } catch (err) { alert("서버 연결 실패!"); }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      
      {/* 최상단 공지사항 팝업 배너 컨테이너 */}
      {showPopup && announcements.length > 0 && (
        <div className="bg-red-600 text-white p-4 text-center relative animate-in slide-in-from-top duration-500 space-y-2">
          {announcements.slice(0, 2).map((announcement) => (
            <p key={announcement.id} className="font-bold">
              <Megaphone size={16} className="inline-block mr-2" />
              <span className="font-black italic mr-2">[{announcement.title}]</span>
              {announcement.content}
            </p>
          ))}
          <button onClick={() => setShowPopup(false)} className="absolute top-1/2 right-4 -translate-y-1/2 hover:bg-white/20 rounded-full p-1">
            <X size={20} />
          </button>
        </div>
      )}

      {/* 상단 바 */}
      <div className="bg-[#e31837] text-white py-3 px-4 sticky top-0 z-50 shadow-md font-bold">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-xs md:text-sm">
          <p className="flex items-center gap-2 uppercase tracking-tighter">
            <Clock size={16} className="animate-pulse" /> FREE ESTIMATES. NO EXTRA CHARGE
          </p>
          <div className="flex items-center gap-6">
            <a href="/status" className="text-white no-underline hover:underline uppercase">Track Service</a>
            <a href="tel:010-1234-5678" className="flex items-center gap-2 font-black no-underline text-white border-l-2 border-white/30 pl-6"><Phone size={18} /> 010-1234-5678</a>
          </div>
        </div>
      </div>

      {/* Hero 섹션 (배경 이미지) */}
      <section className="relative h-[600px] flex items-center justify-center text-white overflow-hidden bg-[#2b1c6d]">
        <div className="absolute inset-0 opacity-40 bg-[url('https://images.pexels.com/photos/2310904/pexels-photo-2310904.jpeg?auto=compress&cs=tinysrgb&w=1600')] bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#2b1c6d]/80 to-[#2b1c6d]/90"></div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center space-y-8">
          <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter drop-shadow-2xl">THE PLUMBING <span className="text-red-500"></span></h1>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <a href="#booking" className="bg-red-600 text-white px-10 py-5 rounded-sm font-black text-2xl no-underline inline-flex items-center justify-center gap-3 shadow-2xl">SCHEDULE ONLINE <ChevronRight size={28} /></a>
            <a href="/status" className="bg-transparent border-2 border-white text-white px-10 py-5 rounded-sm font-black text-2xl no-underline hover:bg-white hover:text-[#2b1c6d] inline-flex items-center justify-center gap-3">TRACK STATUS <Search size={28} /></a>
          </div>
        </div>
      </section>

      {/* 서비스 카드 섹션 (가운데 내용) */}
      <section className="bg-[#2b1c6d] py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-16 uppercase italic tracking-tighter">Our Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ServiceCard icon={<Truck size={48} />} title="Emergency Services" desc="24시간 긴급 출동. 배관 문제 즉시 해결." />
            <ServiceCard icon={<Pipette size={48} />} title="Plumbing & Drains" desc="막힌 하수구부터 노후 배관 교체까지." />
            <ServiceCard icon={<Droplets size={48} />} title="Water Damage" desc="첨단 장비로 누수 지점 정확히 복구." />
            <ServiceCard icon={<Flame size={48} />} title="Water Heaters" desc="온수기 수리 및 교체, 배관 청소 전문가." />
          </div>
        </div>
      </section>

      {/* 예약 폼 섹션 (가독성 개선) */}
      <section id="booking" className="bg-white py-24 px-4 text-left">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-10">
            <h2 className="text-5xl font-black text-[#2b1c6d] italic border-l-8 border-red-600 pl-6 uppercase tracking-tighter">Why Choose Us?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FeatureCard icon={<ShieldCheck className="text-red-600" size={40}/>} title="Licensed Pros" desc="정식 면허 보유 베테랑 직접 시공." />
              <FeatureCard icon={<Heart className="text-red-600" size={40}/>} title="Customer First" desc="깔끔한 뒷정리와 친절 상담 보장." />
              <FeatureCard icon={<Wrench className="text-gray-500" size={40}/>} title="Best Equipment" desc="최신형 고성능 내시경 장비 보유." />
              <FeatureCard icon={<Hammer className="text-gray-500" size={40}/>} title="Full Warranty" desc="시공 후 무상 AS 책임제 실시." />
            </div>
          </div>
          <div className="bg-[#2b1c6d] p-10 shadow-2xl rounded-sm border-t-8 border-red-600">
            <h3 className="text-3xl font-black text-white mb-8 italic flex items-center gap-3"><Send className="text-red-500" /> ONLINE ESTIMATE</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-2"><label className="text-[10px] font-black text-gray-400 block px-2 uppercase">Name</label><input type="text" placeholder="성함" className="w-full p-2 text-black font-bold outline-none" required onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div className="bg-white p-2"><label className="text-[10px] font-black text-gray-400 block px-2 uppercase">Phone</label><input type="text" placeholder="연락처" className="w-full p-2 text-black font-bold outline-none" required onChange={e => setForm({...form, phone: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-2"><label className="text-[10px] font-black text-gray-400 block px-2 uppercase">Address</label><input type="text" placeholder="상세 주소" className="w-full p-2 text-black font-bold outline-none" required onChange={e => setForm({...form, address: e.target.value})} /></div>
                <div className="bg-white p-2"><label className="text-[10px] font-black text-gray-400 block px-2 uppercase">Date & Time</label><input type="datetime-local" className="w-full p-2 text-black font-bold outline-none" required onChange={e => setForm({...form, reservation_datetime: e.target.value})} /></div>
              </div>
              <select className="w-full p-5 bg-white text-black font-black outline-none border-b-8 border-red-600" onChange={e => setForm({...form, issueType: e.target.value})}>
                <option>누수/방수</option><option>변기/하수구 막힘</option><option>보일러/배관 청소</option>
              </select>
              <button className="w-full bg-red-600 text-white p-5 font-black text-2xl hover:bg-red-700 transition shadow-xl uppercase tracking-tighter">Get Started Now</button>
            </form>
            {submittedNumber && (
              <div className="mt-8 p-6 bg-white border-4 border-red-600 text-center animate-bounce shadow-2xl text-black">
                <p className="font-black text-lg mb-1 italic">CODE: <span className="text-red-600">{submittedNumber}</span></p>
                <a href="/status" className="text-xs text-blue-600 font-bold underline">상태 조회하러 가기</a>
              </div>
            )}
          </div>
        </div>
      </section>
      
      <footer className="bg-gray-100 py-16 px-4 border-t-8 border-[#2b1c6d] text-center">
        <p className="font-black text-5xl text-[#2b1c6d] italic uppercase tracking-tighter">Uncle Plumbing</p>
        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-4">Your Trusted Local Experts © 2026</p>
      </footer>
    </div>
  );
}

function ServiceCard({ icon, title, desc }: any) {
  return (
    <div className="bg-white p-10 flex flex-col items-center text-center shadow-xl group hover:-translate-y-2 transition-all">
      <div className="mb-6 w-20 h-20 border-4 border-[#2b1c6d] rounded-full flex items-center justify-center text-[#2b1c6d] group-hover:bg-[#2b1c6d] group-hover:text-white transition-colors">{icon}</div>
      <h3 className="font-black text-xl mb-3 text-[#2b1c6d] uppercase italic leading-none h-12 flex items-center">{title}</h3>
      <p className="text-sm text-gray-500 font-medium">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="flex flex-col items-start p-6 bg-slate-50 border-l-8 border-red-600 shadow-sm">
      <div className="mb-4">{icon}</div>
      <h4 className="font-black text-xl text-[#2b1c6d] uppercase italic">{title}</h4>
      <p className="text-sm text-gray-500 font-medium">{desc}</p>
    </div>
  );
}