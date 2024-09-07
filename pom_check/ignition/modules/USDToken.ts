import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const USDTokenModule = buildModule("USDTokenModule", (m) => {
    const account0 = m.getAccount(0);

    const usd = m.contract("USDToken", [account0]);
    return { usd };
});

export default USDTokenModule;
