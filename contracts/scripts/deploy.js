const hre = require("hardhat");

async function main() {
  const FractionalProperty = await hre.ethers.getContractFactory("FractionalProperty");
  const contract = await FractionalProperty.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("FractionalProperty deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});