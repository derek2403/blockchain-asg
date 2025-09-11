// scripts/deploy-vault.js
// npx hardhat run --network sapphire_testnet scripts/deploy-vault.js
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Vault = await ethers.getContractFactory("PropertyTokenVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();

  console.log("PropertyTokenVault deployed to:", await vault.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});