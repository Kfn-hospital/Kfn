'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import FloatingAssistant from '@/components/FloatingAssistant';

// غلاف بسيط بيمسك حالة فتح/قفل القائمة الجانبية على الموبايل ويمررها
// لـSidebar وHeader، عشان زرار الهامبرجر في الهيدر يقدر يفتح القائمة.
export default function ProtectedShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <FloatingAssistant />
    </div>
  );
}
