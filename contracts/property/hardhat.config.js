// hardhat.config.js
require("dotenv").config();

// IMPORTANT: load Sapphire plugin first so it wraps the provider early
require("@oasisprotocol/sapphire-hardhat");
require("@nomicfoundation/hardhat-toolbox");

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sapphire_testnet: {
      url: process.env.SAPPHIRE_TESTNET_RPC || "https://testnet.sapphire.oasis.io",
      chainId: 23295,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};