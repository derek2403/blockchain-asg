import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left - Logo */}
          <div className="flex-shrink-0">
            <div className="h-8 w-40 flex items-center justify-center">
              <span 
                className="text-gray-800 text-lg font-bold"
                style={{
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: "0.1em",
                  textShadow: "2px 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                Blocks of Bricks
              </span>
            </div>
          </div>

          {/* Middle - Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link 
              href="/menu" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Menu
            </Link>
            <Link 
              href="/property-flow" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              List
            </Link>
            <Link 
              href="/trade" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Trade
            </Link>
            <Link 
              href="/dividend" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Dividend
            </Link>
          </nav>

          {/* Right - Connect Wallet Button */}
          <div className="flex-shrink-0">
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
} 