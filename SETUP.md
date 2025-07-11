# Blockchain Assignment Setup Guide

This guide will help you set up the complete decentralized auction system with real-time event monitoring.

## 🏗️ Project Overview

The project consists of:
1. **Smart Contract**: Decentralized auction system on Arbitrum Sepolia
2. **Event Scanner**: Real-time event monitoring using The Graph
3. **Web Application**: Next.js frontend for interaction

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask or similar wallet
- Arbitrum Sepolia testnet ETH
- Subgraph Studio account

## 🚀 Quick Start

### 1. Smart Contract Deployment

#### Step 1: Configure Environment
```bash
cd contract
cp .env.example .env
```

Edit `.env` and add your private key:
```env
PRIVATE_KEY=your_private_key_here
```

#### Step 2: Deploy Contract
```bash
# Deploy to Arbitrum Sepolia testnet
npx hardhat run scripts/deploy.js --network arbitrumTestnet
```

#### Step 3: Verify Contract (Optional)
```bash
# Verify on Blockscout
npx hardhat verify --network arbitrumTestnet DEPLOYED_CONTRACT_ADDRESS
```

### 2. Event Scanner Setup

#### Step 1: Install Graph CLI
```bash
npm install -g @graphprotocol/graph-cli
```

#### Step 2: Create Subgraph Studio Account
1. Go to [Subgraph Studio](https://studio.thegraph.com/)
2. Connect your wallet
3. Create a new subgraph
4. Copy your deploy key

#### Step 3: Deploy Subgraph
```bash
cd subgraph
./deploy.sh YOUR_DEPLOY_KEY
```

#### Step 4: Update Frontend
After deployment, update the Apollo Client URI in `pages/event-scanner.js`:
```javascript
const client = new ApolloClient({
  uri: 'YOUR_SUBGRAPH_QUERY_URL', // Replace with your deployed subgraph URL
  cache: new InMemoryCache(),
});
```

### 3. Web Application

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Start Development Server
```bash
npm run dev
```

#### Step 3: Access Application
Navigate to `http://localhost:3000`

## 🔧 Detailed Setup

### Smart Contract Features

The auction contract includes:
- ✅ Create auctions with custom duration and starting price
- ✅ Real-time bidding with automatic refunds
- ✅ Event-driven architecture with comprehensive logging
- ✅ Leaderboard and historical bid tracking
- ✅ Auction cancellation and emergency functions
- ✅ Blockscout verification support

### Event Scanner Features

The event scanner provides:
- ✅ Subscribe to any contract address on Arbitrum Sepolia
- ✅ Real-time event monitoring with 10-second polling
- ✅ Historical event scanning and data visualization
- ✅ Duplicate prevention and persistent subscriptions
- ✅ Custom event signature support
- ✅ Universal event indexing

### Web Application Features

The frontend includes:
- ✅ Modern, responsive UI with Tailwind CSS
- ✅ Real-time event visualization
- ✅ Subscription management
- ✅ Historical data loading
- ✅ Error handling and user feedback

## 📊 Usage Examples

### Creating an Auction
1. Deploy the auction contract
2. Call `createAuction(itemName, description, startingPrice, durationMinutes)`
3. Monitor events in real-time

### Monitoring Events
1. Navigate to `/event-scanner`
2. Enter contract address
3. Select event signature
4. Click "Subscribe to Events"
5. View real-time updates

### Common Event Signatures
- `Transfer(address,address,uint256)` - Token transfers
- `Approval(address,address,uint256)` - Token approvals
- `NewBid(uint256,address,uint256,uint256)` - Auction bidding
- `AuctionEnded(uint256,address,uint256,uint256)` - Auction completion

## 🔍 Troubleshooting

### Smart Contract Issues
- **Deployment fails**: Check private key and network configuration
- **Verification fails**: Ensure Blockscout API is accessible
- **Gas issues**: Ensure sufficient ETH on Arbitrum Sepolia

### Subgraph Issues
- **Deployment fails**: Check deploy key and network connectivity
- **No events**: Verify contract address and event signatures
- **Sync issues**: Check Subgraph Studio logs

### Frontend Issues
- **GraphQL errors**: Verify subgraph URL and network
- **No data**: Check Apollo Client configuration
- **Performance**: Adjust polling intervals if needed

## 🛠️ Development

### Adding New Features

#### Smart Contract
1. Modify `contract/contracts/Lock.sol`
2. Add new events and functions
3. Deploy and verify

#### Event Scanner
1. Update `subgraph/schema.graphql`
2. Modify `subgraph/src/mapping.ts`
3. Redeploy subgraph

#### Frontend
1. Update `pages/event-scanner.js`
2. Add new UI components
3. Test with real contracts

### Testing

#### Smart Contract Testing
```bash
cd contract
npx hardhat test
```

#### Frontend Testing
```bash
npm run dev
# Navigate to http://localhost:3000/event-scanner
```

## 📚 Resources

- [Arbitrum Sepolia Faucet](https://faucet.quicknode.com/arbitrum/sepolia)
- [Subgraph Studio](https://studio.thegraph.com/)
- [Graph Protocol Documentation](https://thegraph.com/docs/)
- [Hardhat Documentation](https://hardhat.org/docs)

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review console logs and error messages
3. Verify network connectivity and configurations
4. Test with known working contract addresses

## 📄 License

This project is part of a blockchain assignment demonstrating decentralized auction systems and event monitoring. 