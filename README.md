# Real Estate Fractionalization dApp

A decentralized application that enables fractional ownership of real estate properties through blockchain tokenization. Built with Next.js and deployed on Oasis Sapphire testnet.

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- A Web3 wallet (MetaMask recommended)
- Oasis Sapphire testnet ROSE tokens for gas fees

### Installation

1. **Navigate to the root directory**
   ```bash
   cd blockchain-asg
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   Create a `.env` file in the root directory with the following variables:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ENCRYPTION_KEY_BASE64=your_encryption_key_here
   PRIVATEKEY=your_wallet_private_key_here
   ```

4. **Generate encryption key**
   Run the following command to generate your encryption key:
   ```bash
   node AESKey.js
   ```
   Copy the generated key and paste it as `ENCRYPTION_KEY_BASE64` in your `.env` file.

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **User Registration**: AI-powered IC document verification
- **Property Listing**: Tokenize real estate into 100 fractional shares
- **Trading Platform**: Buy and sell property tokens
- **Dividend Distribution**: Distribute earnings to token holders
- **Blockchain Integration**: Secure data storage on Oasis Sapphire

## Smart Contracts

- **PropertyTokenFactory**: Mints ERC20 tokens for properties
- **TokenEscrow**: Manages peer-to-peer token trading
- **PropertyTokenVault**: Handles direct token purchases
- **ConfidentialStrings**: Stores encrypted property metadata

## Network

This dApp runs on **Oasis Sapphire Testnet**:
- Chain ID: 23295 (0x5aff)
- RPC URL: https://testnet.sapphire.oasis.io
- Explorer: https://explorer.oasis.io/testnet/sapphire
