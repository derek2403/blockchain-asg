import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Head>
        <title>Blockchain Assignment - Decentralized Auction & Event Scanner</title>
        <meta name="description" content="Decentralized auction system with real-time event monitoring" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Blockchain Assignment</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/event-scanner" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                Event Scanner
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Decentralized Auction System
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            A comprehensive blockchain solution featuring smart contract auctions and real-time event monitoring
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/event-scanner" className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
              Launch Event Scanner
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-blue-600 text-3xl mb-4">🏗️</div>
            <h3 className="text-xl font-semibold mb-2">Smart Contract</h3>
            <p className="text-gray-600">
              Decentralized auction system built on Arbitrum testnet with real-time bidding, events, and automated refunds.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-blue-600 text-3xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Event Scanner</h3>
            <p className="text-gray-600">
              Real-time Ethereum event monitoring using The Graph protocol with historical data and subscription management.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-blue-600 text-3xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold mb-2">Real-time Updates</h3>
            <p className="text-gray-600">
              Live event tracking with automatic polling, duplicate prevention, and persistent state management.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-4 text-blue-600">Auction System</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Create auctions with custom duration and starting price</li>
                <li>• Real-time bidding with automatic refunds</li>
                <li>• Event-driven architecture with comprehensive logging</li>
                <li>• Leaderboard and historical bid tracking</li>
                <li>• Auction cancellation and emergency functions</li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4 text-blue-600">Event Scanner</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Subscribe to any contract address on Arbitrum testnet</li>
                <li>• Real-time event monitoring with 10-second polling</li>
                <li>• Historical event scanning and data visualization</li>
                <li>• Duplicate prevention and persistent subscriptions</li>
                <li>• Custom event signature support</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Explore?</h2>
          <p className="text-gray-600 mb-6">
            Start monitoring blockchain events in real-time or deploy your own auction contract
          </p>
          <Link href="/event-scanner" className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors">
            Start Event Scanner
          </Link>
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-300">
            Blockchain Assignment - Decentralized Auction System & Event Scanner
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Built with Next.js, Hardhat, The Graph, and Arbitrum testnet
          </p>
        </div>
      </footer>
    </div>
  );
}
