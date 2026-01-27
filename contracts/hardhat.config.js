require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config({ path: "../config/.env" });

const PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    amoy: {
      url: process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: [PRIVATE_KEY],
      chainId: 80002
    },
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 137
    }
  },
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  }
};
