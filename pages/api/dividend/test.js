// pages/api/dividend/test.js
import { JsonRpcProvider, Wallet, formatEther } from "ethers";

// RPC endpoint for Oasis Sapphire Testnet
const RPC_URL = process.env.SAPPHIRE_TESTNET_RPC || "https://testnet.sapphire.oasis.io";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).send("Method not allowed");
    }

    const results = {};

    // Test 1: Check environment variable
    const privateKey = process.env.PRIVATEKEY;
    if (!privateKey) {
      results.privateKey = "❌ PRIVATEKEY environment variable not set";
    } else {
      const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      if (!/^[0-9a-fA-F]{64}$/.test(cleanPrivateKey)) {
        results.privateKey = `❌ Invalid private key format. Length: ${cleanPrivateKey.length}`;
      } else {
        results.privateKey = "✅ Private key format is valid";
      }
    }

    // Test 2: Check RPC connection
    try {
      console.log("Testing RPC connection...");
      const provider = new JsonRpcProvider(RPC_URL);
      const blockNumber = await provider.getBlockNumber();
      results.rpcConnection = `✅ RPC connected. Current block: ${blockNumber}`;
    } catch (error) {
      results.rpcConnection = `❌ RPC connection failed: ${error.message}`;
    }

    // Test 3: Check wallet creation and balance
    if (privateKey && /^[0-9a-fA-F]{64}$/.test(privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey)) {
      try {
        const provider = new JsonRpcProvider(RPC_URL);
        const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
        const wallet = new Wallet(cleanKey, provider);
        
        const balance = await provider.getBalance(wallet.address);
        const balanceETH = formatEther(balance);
        
        results.wallet = {
          address: wallet.address,
          balance: `${balanceETH} TEST`,
          status: "✅ Wallet created successfully"
        };
      } catch (error) {
        results.wallet = `❌ Wallet creation failed: ${error.message}`;
      }
    }

    // Test 4: Check network
    results.network = {
      rpcUrl: RPC_URL,
      chainId: "Oasis Sapphire Testnet (23295)"
    };

    return res.status(200).json({
      status: "Dividend Distribution Test",
      timestamp: new Date().toISOString(),
      tests: results
    });

  } catch (err) {
    console.error("Test API Error:", err);
    res.status(500).send(err.message || "Test failed");
  }
}
