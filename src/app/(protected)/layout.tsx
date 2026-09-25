import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import FloatingAssistant from '@/components/FloatingAssistant';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <FloatingAssistant />
    </div>
  );
}
