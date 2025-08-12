import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left - Logo placeholder */}
          <div className="flex-shrink-0">
            <div className="h-8 w-32 bg-gray-300 rounded flex items-center justify-center">
              <span className="text-gray-600 text-sm font-medium">LOGO</span>
            </div>
          </div>

          {/* Middle - Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link 
              href="/list" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              List
            </Link>
            <Link 
              href="/buy" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Buy
            </Link>
            <Link 
              href="/trade" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Trade
            </Link>
            <Link 
              href="/dashboard" 
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Dashboard
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