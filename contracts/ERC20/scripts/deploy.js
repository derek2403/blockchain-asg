// scripts/deploy.js
// npx hardhat run --network sapphire_testnet scripts/deploy.js

const hre = require("hardhat");

async function main() {
  await hre.run("compile");

  const factory = await hre.ethers.deployContract("PropertyTokenFactory");
  await factory.waitForDeployment();

  console.log("PropertyTokenFactory deployed to:", await factory.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});