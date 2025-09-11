require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const SAPPHIRE_RPC = process.env.SAPPHIRE_TESTNET_RPC || "https://testnet.sapphire.oasis.io";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    sapphire_testnet: {
      url: SAPPHIRE_RPC,
      chainId: 23295,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};