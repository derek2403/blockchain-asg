const hre = require("hardhat");

async function main() {
  console.log("Deploying DecentralizedAuction contract to Arbitrum Testnet...");

  // Get the contract factory
  const DecentralizedAuction = await hre.ethers.getContractFactory("DecentralizedAuction");
  
  // Deploy the contract
  const auctionContract = await DecentralizedAuction.deploy();
  
  // Wait for deployment to complete
  await auctionContract.waitForDeployment();
  
  const contractAddress = await auctionContract.getAddress();
  
  console.log("✅ DecentralizedAuction deployed successfully!");
  console.log("📋 Contract Address:", contractAddress);
  console.log("🌐 Network: Arbitrum Testnet (Sepolia)");
  console.log("🔗 Explorer: https://sepolia.arbiscan.io/address/" + contractAddress);
  
  // Verify the contract on Arbiscan (optional)
  console.log("\n🔍 Verifying contract on Arbiscan...");
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("✅ Contract verified on Arbiscan!");
  } catch (error) {
    console.log("⚠️  Contract verification failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 