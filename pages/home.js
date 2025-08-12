import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      router.push('/login');
      return;
    }

    const checkUser = async () => {
      try {
        const response = await fetch('/api/check-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: address }),
        });

        const data = await response.json();
        
        if (data.exists) {
          setUserData(data.user);
        } else {
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Error checking user:', error);
        router.push('/login');
        return;
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [isConnected, address, router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Welcome Home!</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">Wallet Information</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-blue-700">Address:</span>
                <div className="text-blue-600 font-mono break-all">{address}</div>
              </div>
              <div>
                <span className="font-medium text-blue-700">Status:</span>
                <span className="text-green-600 ml-2">Connected</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-green-900 mb-3">IC Information</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-green-700">IC Number:</span>
                <div className="text-green-600">{userData.icNumber}</div>
              </div>
              <div>
                <span className="font-medium text-green-700">Status:</span>
                <span className="text-green-600 ml-2">Verified</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
            <button 
              onClick={() => router.push('/list')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              View Listings
            </button>
            <button 
              onClick={() => router.push('/trade')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Trade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 