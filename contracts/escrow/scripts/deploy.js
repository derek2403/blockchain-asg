const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const TokenEscrow = await hre.ethers.getContractFactory("TokenEscrow");
  const escrow = await TokenEscrow.deploy();
  await escrow.waitForDeployment();

  console.log("TokenEscrow deployed to:", await escrow.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});