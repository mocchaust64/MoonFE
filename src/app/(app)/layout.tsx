import Sidebar from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-hidden pt-14">
      <div className="flex h-[calc(100%-3.5rem)] justify-center">
        <div className="flex w-[1064px]">
          {" "}
          {/* 264px (sidebar) + 800px (content) */}
          {/* Sidebar */}
          <div className="bg-muted/10 w-64 border-r">
            <Sidebar />
          </div>
          {/* Main content */}
          <div className="w-[800px] overflow-y-auto">
            <div className="h-full px-8 py-6">
              <main>{children}</main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
