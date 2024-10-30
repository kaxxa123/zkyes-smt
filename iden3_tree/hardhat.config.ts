import { vars, HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const SECRET_KEY_0 = vars.get("SECRET_KEY_0");
const INFURA_PROJECT_ID = vars.get("INFURA_PROJECT_ID");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
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
    },
    eth: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [SECRET_KEY_0]
    },
  }

};

export default config;
