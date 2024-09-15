import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DeployModule = buildModule("DeployModule", (m) => {
    const smt = m.contract("TokenSnapshot");
    return { smt };
});

export default DeployModule;
