import { useState, useEffect } from 'react';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { ethers } from 'ethers';

// Initialize Apollo Client for The Graph
const client = new ApolloClient({
  uri: 'https://api.studio.thegraph.com/query/115999/assignment/version/latest',
  cache: new InMemoryCache(),
});

// Common event signatures for popular events
const COMMON_EVENTS = {
  'Transfer(address,address,uint256)': '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  'Approval(address,address,uint256)': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
  'NewBid(uint256,address,uint256,uint256)': '0x1234567890abcdef', // Placeholder for your auction events
  'AuctionEnded(uint256,address,uint256,uint256)': '0xabcdef1234567890', // Placeholder for your auction events
};

export default function EventScanner() {
  const [contractAddress, setContractAddress] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [customEventSignature, setCustomEventSignature] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [lastProcessedBlock, setLastProcessedBlock] = useState(0);

  // Load saved subscriptions from localStorage
  useEffect(() => {
    const savedSubscriptions = localStorage.getItem('eventScannerSubscriptions');
    if (savedSubscriptions) {
      setSubscriptions(JSON.parse(savedSubscriptions));
    }
    
    const savedLastBlock = localStorage.getItem('lastProcessedBlock');
    if (savedLastBlock) {
      setLastProcessedBlock(parseInt(savedLastBlock));
    }
  }, []);

  // Save subscriptions to localStorage
  useEffect(() => {
    localStorage.setItem('eventScannerSubscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  // Save last processed block
  useEffect(() => {
    localStorage.setItem('lastProcessedBlock', lastProcessedBlock.toString());
  }, [lastProcessedBlock]);

  const validateContractAddress = (address) => {
    return ethers.isAddress(address);
  };

  const validateEventSignature = (signature) => {
    // Basic validation for event signature format
    return signature.includes('(') && signature.includes(')');
  };

  const subscribeToContract = () => {
    if (!validateContractAddress(contractAddress)) {
      setError('Invalid contract address');
      return;
    }

    const eventSignature = selectedEvent || customEventSignature;
    if (!eventSignature) {
      setError('Please select or enter an event signature');
      return;
    }

    if (!validateEventSignature(eventSignature)) {
      setError('Invalid event signature format');
      return;
    }

    const subscription = {
      id: Date.now(),
      contractAddress: contractAddress.toLowerCase(),
      eventSignature,
      createdAt: new Date().toISOString(),
      lastProcessedBlock: lastProcessedBlock,
    };

    setSubscriptions([...subscriptions, subscription]);
    setContractAddress('');
    setSelectedEvent('');
    setCustomEventSignature('');
    setError('');
  };

  const unsubscribeFromContract = (subscriptionId) => {
    setSubscriptions(subscriptions.filter(sub => sub.id !== subscriptionId));
  };

  const fetchEvents = async (subscription) => {
    setLoading(true);
    setError('');

    try {
      // Query The Graph for events
      const query = gql`
        query GetEvents($contractAddress: String!, $fromBlock: BigInt!) {
          events(
            where: {
              contractAddress: $contractAddress,
              blockNumber_gte: $fromBlock
            }
            orderBy: blockNumber
            orderDirection: desc
            first: 100
          ) {
            id
            contractAddress
            eventSignature
            blockNumber
            blockTimestamp
            transactionHash
            logIndex
            data
            topics
          }
        }
      `;

      const result = await client.query({
        query,
        variables: {
          contractAddress: subscription.contractAddress,
          fromBlock: subscription.lastProcessedBlock.toString(),
        },
        fetchPolicy: 'network-only',
      });

      if (result.data?.events) {
        const newEvents = result.data.events.map(event => ({
          ...event,
          subscriptionId: subscription.id,
          timestamp: new Date(event.blockTimestamp * 1000).toLocaleString(),
        }));

        setEvents(prev => [...newEvents, ...prev]);
        
        // Update last processed block
        if (newEvents.length > 0) {
          const maxBlock = Math.max(...newEvents.map(e => parseInt(e.blockNumber)));
          setLastProcessedBlock(maxBlock);
          
          // Update subscription's last processed block
          setSubscriptions(prev => prev.map(sub => 
            sub.id === subscription.id 
              ? { ...sub, lastProcessedBlock: maxBlock }
              : sub
          ));
        }
      }
    } catch (err) {
      setError(`Error fetching events: ${err.message}`);
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalEvents = async (subscription) => {
    setLoading(true);
    setError('');

    try {
      // Query for historical events (last 1000 blocks)
      const fromBlock = Math.max(0, lastProcessedBlock - 1000);
      
      const query = gql`
        query GetHistoricalEvents($contractAddress: String!, $fromBlock: BigInt!) {
          events(
            where: {
              contractAddress: $contractAddress,
              blockNumber_gte: $fromBlock
            }
            orderBy: blockNumber
            orderDirection: desc
            first: 1000
          ) {
            id
            contractAddress
            eventSignature
            blockNumber
            blockTimestamp
            transactionHash
            logIndex
            data
            topics
          }
        }
      `;

      const result = await client.query({
        query,
        variables: {
          contractAddress: subscription.contractAddress,
          fromBlock: fromBlock.toString(),
        },
        fetchPolicy: 'network-only',
      });

      if (result.data?.events) {
        const historicalEvents = result.data.events.map(event => ({
          ...event,
          subscriptionId: subscription.id,
          timestamp: new Date(event.blockTimestamp * 1000).toLocaleString(),
        }));

        setEvents(historicalEvents);
      }
    } catch (err) {
      setError(`Error fetching historical events: ${err.message}`);
      console.error('Error fetching historical events:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time polling for new events
  useEffect(() => {
    if (subscriptions.length === 0) return;

    const interval = setInterval(() => {
      subscriptions.forEach(subscription => {
        fetchEvents(subscription);
      });
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [subscriptions, lastProcessedBlock]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Ethereum Event Scanner
          </h1>
          <p className="text-lg text-gray-600">
            Monitor smart contract events in real-time using The Graph
          </p>
        </div>

        {/* Subscription Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Subscribe to Contract Events</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contract Address
              </label>
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Signature
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select common event</option>
                {Object.keys(COMMON_EVENTS).map((event) => (
                  <option key={event} value={event}>
                    {event}
                  </option>
                ))}
                <option value="custom">Custom Event</option>
              </select>
            </div>
          </div>

          {selectedEvent === 'custom' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Event Signature
              </label>
              <input
                type="text"
                value={customEventSignature}
                onChange={(e) => setCustomEventSignature(e.target.value)}
                placeholder="EventName(type1,type2,...)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <button
            onClick={subscribeToContract}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Subscribe to Events
          </button>
        </div>

        {/* Active Subscriptions */}
        {subscriptions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Active Subscriptions</h2>
            <div className="space-y-4">
              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        Contract: {subscription.contractAddress}
                      </p>
                      <p className="text-sm text-gray-600">
                        Event: {subscription.eventSignature}
                      </p>
                      <p className="text-xs text-gray-500">
                        Subscribed: {new Date(subscription.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => fetchHistoricalEvents(subscription)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        Load History
                      </button>
                      <button
                        onClick={() => unsubscribeFromContract(subscription.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Unsubscribe
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events Table */}
        {events.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Detected Events</h2>
              <div className="text-sm text-gray-500">
                {loading ? 'Loading...' : `${events.length} events`}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contract
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Block
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.timestamp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-mono text-xs">
                          {event.contractAddress.slice(0, 10)}...{event.contractAddress.slice(-8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-mono text-xs">
                          {event.eventSignature}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.blockNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <a
                          href={`https://sepolia.arbiscan.io/tx/${event.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-mono text-xs"
                        >
                          {event.transactionHash.slice(0, 10)}...{event.transactionHash.slice(-8)}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 hover:text-blue-800">
                            View Data
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Events State */}
        {events.length === 0 && subscriptions.length > 0 && !loading && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-500">No events detected yet. Events will appear here in real-time.</p>
          </div>
        )}
      </div>
    </div>
  );
} 