import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex pt-14">
        <div className="w-64 flex-shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1 flex justify-center px-6">
          <div className="max-w-[1000px] w-full">
            <main className="py-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
} 