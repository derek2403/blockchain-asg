// scripts/deploy.js
// Usage: npx hardhat run --network sapphire_testnet scripts/deploy.js

const hre = require("hardhat");

async function main() {
  // This compiles if needed and wires a ContractFactory with bytecode.
  const contract = await hre.ethers.deployContract("ConfidentialStrings");
  await contract.waitForDeployment();

  console.log("ConfidentialStrings deployed to:", await contract.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});