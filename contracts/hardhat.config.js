require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    arbitrumSepolia: {
      url: "https://arb-sepolia.g.alchemy.com/v2/6U7t79S89NhHIspqDQ7oKGRWp5ZOfsNj",
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
