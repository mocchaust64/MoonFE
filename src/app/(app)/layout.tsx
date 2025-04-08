import Sidebar from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-hidden pt-14">
      <div className="flex h-[calc(100%-3.5rem)] md:justify-center">
        <div className="flex w-full flex-col md:w-[1064px] md:flex-row">
          {/* Sidebar - Desktop */}
          <div className="md:bg-muted/10 hidden md:block md:w-64">
            <Sidebar />
          </div>

          {/* Main content */}
          <div
            className={cn(
              "w-full pb-16 md:w-[800px] md:overflow-y-auto md:pb-0",
            )}
          >
            <div className="h-full px-4 py-4 md:px-8 md:py-6">
              <main>{children}</main>
            </div>
          </div>

          {/* Mobile Navigation - Fixed at bottom */}
          <div className="bg-background fixed right-0 bottom-0 left-0 z-50 border-t md:hidden">
            <Sidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
