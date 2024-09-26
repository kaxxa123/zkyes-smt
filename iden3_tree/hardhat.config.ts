import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    reth: {
      url: "http://localhost:8545",
      gasPrice: 225000000000,
      accounts: { mnemonic: "test test test test test test test test test test test junk" }
    }
  }

};

export default config;
