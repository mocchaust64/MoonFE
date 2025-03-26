import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex-1 flex justify-center px-6">
        <div className="max-w-[1000px] w-full flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-6 pl-[88px]">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-bold text-xl">MoonWallet</span>
            </Link>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {/* Network Status */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm">Network Status</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Connected to Mainnet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Wallet Connection */}
            <Button variant="outline" className="flex items-center gap-2">
              <span>Connect Wallet</span>
            </Button>

            {/* Additional Options */}
            <Button variant="ghost" size="icon">
              <span className="sr-only">Additional options</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
