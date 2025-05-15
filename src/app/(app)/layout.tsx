import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen h-full bg-[#030303] text-white">
      {/* Add Header component */}
      <Header />
      
      <div className="flex h-[calc(100vh-3.5rem)] pt-14">
        {/* Sidebar - Desktop */}
        <div className="hidden md:block md:border-r md:border-zinc-800/30 bg-[#080808]" style={{ width: '320px' }}>
          <Sidebar />
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto bg-[#030303]">
          <div className="h-full p-4 md:p-8">
            <main>{children}</main>
          </div>
        </div>

        {/* Mobile Navigation - Fixed at bottom */}
        <div className="bg-[#080808] fixed right-0 bottom-0 left-0 z-50 border-t border-zinc-800/30 md:hidden shadow-lg">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
