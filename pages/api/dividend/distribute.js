// pages/api/dividend/distribute.js
import { JsonRpcProvider, Wallet, parseEther, formatEther } from "ethers";

const RPC_URL = process.env.SAPPHIRE_TESTNET_RPC || "https://testnet.sapphire.oasis.io";

// Ensure Next.js parses the body
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  // Add overall timeout
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.log("TIMEOUT: Request took too long");
      res.status(408).send("Request timeout");
    }
  }, 60000); // 60 second timeout

  try {
    console.log("\n=== DIVIDEND DISTRIBUTE API CALLED ===");
    console.log("Method:", req.method);
    
    if (req.method !== "POST") {
      clearTimeout(timeout);
      return res.status(405).send("Method not allowed");
    }

    console.log("Using Next.js built-in body parser...");
    console.log("req.body:", JSON.stringify(req.body, null, 2));
    
    const { earningsAmount, holders, timestamp } = req.body;
    
    if (timestamp) {
      console.log("Request timestamp:", timestamp);
    }

    // Simple validation
    if (!earningsAmount || isNaN(earningsAmount) || Number(earningsAmount) <= 0) {
      clearTimeout(timeout);
      return res.status(400).send("Invalid earnings amount");
    }
    if (!Array.isArray(holders) || holders.length === 0) {
      clearTimeout(timeout);
      return res.status(400).send("No holders provided");
    }

    // Get private key
    const privateKey = process.env.PRIVATEKEY;
    if (!privateKey) {
      clearTimeout(timeout);
      return res.status(500).send("PRIVATEKEY not configured");
    }

    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    console.log("=== SIMPLE DISTRIBUTION STARTING ===");
    console.log(`Earnings: ${earningsAmount} TEST`);
    console.log(`Holders: ${holders.length}`);
    
    // Create provider and wallet
    const provider = new JsonRpcProvider(RPC_URL);
    const wallet = new Wallet(cleanPrivateKey, provider);
    
    console.log(`From wallet: ${wallet.address}`);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceETH = formatEther(balance);
    console.log(`Wallet balance: ${balanceETH} TEST`);
    
    if (Number(balanceETH) < Number(earningsAmount)) {
      return res.status(400).send(`Insufficient balance. Need ${earningsAmount}, have ${balanceETH}`);
    }
    
    const results = [];
    
    // Process each holder ONE BY ONE (sequential)
    for (let i = 0; i < holders.length; i++) {
      const holder = holders[i];
      const percentage = Number(holder.percentage);
      const amount = (Number(earningsAmount) * percentage) / 100;
      
      console.log(`\n--- Transfer ${i + 1}/${holders.length} ---`);
      console.log(`To: ${holder.address}`);
      console.log(`Amount: ${amount.toFixed(6)} TEST (${percentage}%)`);
      
      // Skip very small amounts
      if (amount < 0.000001) {
        console.log("SKIPPED: Amount too small");
        continue;
      }
      
      try {
        // Simple transfer transaction
        const tx = await wallet.sendTransaction({
          to: holder.address,
          value: parseEther(amount.toString()),
          gasLimit: 21000,
        });
        
        console.log(`SUCCESS: TX ${tx.hash}`);
        
        results.push({
          to: holder.address,
          amount: amount.toFixed(6),
          percentage: percentage.toFixed(4),
          txHash: tx.hash,
          status: "sent"
        });
        
      } catch (error) {
        console.log(`FAILED: ${error.message}`);
        
        results.push({
          to: holder.address,
          amount: amount.toFixed(6),
          percentage: percentage.toFixed(4),
          error: error.message,
          status: "failed"
        });
      }
      
      // Small delay between transactions
      if (i < holders.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.filter(r => r.status === "sent").length;
    const totalDistributed = results
      .filter(r => r.status === "sent")
      .reduce((sum, r) => sum + Number(r.amount), 0);
    
    console.log("\n=== DISTRIBUTION COMPLETE ===");
    console.log(`Success: ${successCount}/${holders.length}`);
    console.log(`Total distributed: ${totalDistributed.toFixed(6)} TEST`);
    
    clearTimeout(timeout);
    return res.status(200).json({
      success: true,
      successCount,
      totalDistributed: totalDistributed.toFixed(6),
      transactions: results.filter(r => r.status === "sent"),
      errors: results.filter(r => r.status === "failed"),
      message: `Simple distribution complete! Sent ${successCount} transfers.`
    });

  } catch (err) {
    console.error("Distribution error:", err);
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(500).send(err.message || "Distribution failed");
    }
  }
}
