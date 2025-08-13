import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// --- Add custom Oasis Sapphire Testnet chain ---
export const sapphireTestnet = {
  id: 23295,
  name: 'Oasis Sapphire Testnet',
  network: 'sapphire-testnet',
  nativeCurrency: {
    name: 'Sapphire Test ROSE',
    symbol: 'TEST',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://testnet.sapphire.oasis.io'] },
    public: { http: ['https://testnet.sapphire.oasis.io'] },
  },
  blockExplorers: {
    default: {
      name: 'Oasis Explorer',
      url: 'https://explorer.oasis.io/testnet/sapphire',
    },
  },
  testnet: true,
};

const config = getDefaultConfig({
  appName: '1inch Agent Kit',
  projectId: 'YOUR_PROJECT_ID', // from WalletConnect Cloud
  chains: [sapphireTestnet],
  ssr: true, // Enable server-side rendering
});

export default config;