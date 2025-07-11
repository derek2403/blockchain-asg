# Event Scanner Subgraph

A universal Ethereum event scanner subgraph for Arbitrum Sepolia testnet that indexes events from any contract address.

## Features

- **Universal Event Indexing**: Monitors events from any contract address
- **Real-time Updates**: Indexes new events as they occur
- **Historical Data**: Provides access to past events
- **Duplicate Prevention**: Avoids rescanning old events
- **Event Decoding**: Attempts to decode common event signatures

## Prerequisites

1. **Graph CLI**: Install the Graph CLI globally
   ```bash
   npm install -g @graphprotocol/graph-cli
   ```

2. **Subgraph Studio Account**: Create an account at [Subgraph Studio](https://studio.thegraph.com/)

## Deployment Steps

### 1. Initialize the Subgraph

```bash
# Navigate to the subgraph directory
cd subgraph

# Install dependencies
npm install

# Generate code from the schema
npm run codegen

# Build the subgraph
npm run build
```

### 2. Deploy to Subgraph Studio

```bash
# Authenticate with your deploy key from Subgraph Studio
graph auth <DEPLOY_KEY>

# Deploy the subgraph
npm run deploy
```

### 3. Update the Frontend

After deployment, update the Apollo Client URI in `pages/event-scanner.js`:

```javascript
const client = new ApolloClient({
  uri: 'YOUR_SUBGRAPH_QUERY_URL', // Replace with your deployed subgraph URL
  cache: new InMemoryCache(),
});
```

## Usage

### Web Application

1. Start the Next.js development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/event-scanner`

3. Enter any contract address on Arbitrum Sepolia testnet

4. Select or enter an event signature

5. Click "Subscribe to Events" to start monitoring

### Features

- **Contract Address Input**: Enter any valid contract address
- **Event Signature Selection**: Choose from common events or enter custom signatures
- **Real-time Monitoring**: Events are polled every 10 seconds
- **Historical Data**: Load past events with the "Load History" button
- **Persistent Subscriptions**: Subscriptions are saved in localStorage
- **Event Visualization**: View events in a comprehensive table format

## Event Signatures

The scanner supports these common event signatures:

- `Transfer(address,address,uint256)` - ERC20/ERC721 transfers
- `Approval(address,address,uint256)` - Token approvals
- `NewBid(uint256,address,uint256,uint256)` - Auction bidding
- `AuctionEnded(uint256,address,uint256,uint256)` - Auction completion

## Custom Events

To monitor custom events:

1. Select "Custom Event" from the dropdown
2. Enter the event signature in the format: `EventName(type1,type2,...)`
3. Click "Subscribe to Events"

## Architecture

### Subgraph Components

- **`subgraph.yaml`**: Defines the data sources and event handlers
- **`schema.graphql`**: Defines the Event entity structure
- **`src/mapping.ts`**: AssemblyScript code that processes events
- **`abis/EventScanner.json`**: ABI for generic event handling

### Frontend Components

- **Real-time Polling**: 10-second intervals for new events
- **Local Storage**: Persists subscriptions and last processed block
- **Duplicate Prevention**: Tracks last processed block to avoid duplicates
- **Error Handling**: Comprehensive error handling and user feedback

## Troubleshooting

### Common Issues

1. **No Events Found**: Ensure the contract address is correct and has emitted events
2. **GraphQL Errors**: Check that the subgraph is properly deployed and synced
3. **Network Issues**: Verify you're connected to Arbitrum Sepolia testnet

### Debugging

1. Check the browser console for errors
2. Verify the subgraph deployment status in Subgraph Studio
3. Test queries directly in the Graph Explorer

## Development

### Adding New Event Signatures

1. Update the `COMMON_EVENTS` object in `pages/event-scanner.js`
2. Add the signature mapping in `subgraph/src/mapping.ts`
3. Redeploy the subgraph

### Customizing the Schema

1. Modify `schema.graphql` to add new fields
2. Update the mapping in `src/mapping.ts`
3. Regenerate and redeploy

## Support

For issues or questions:

1. Check the Graph Protocol documentation
2. Review the Subgraph Studio logs
3. Test queries in the Graph Explorer

## License

This project is part of a blockchain assignment demonstrating decentralized auction systems and event monitoring. 