require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    arbitrumTestnet: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000, // 20 gwei
    },
  },
  etherscan: {
    apiKey: {
      arbitrumTestnet: "abc", // Blockscout does not require a real API key, just a non-empty string
    },
    customChains: [
      {
        network: "arbitrumTestnet",
        chainId: 421614,
        urls: {
          apiURL: "https://arbitrum-sepolia.blockscout.com/api",
          browserURL: "https://arbitrum-sepolia.blockscout.com/",
        },
      },
    ],
  },
};
