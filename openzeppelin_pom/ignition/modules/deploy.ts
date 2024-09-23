import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import TokenDrop from "./TokenDrop";

const DeployModule = buildModule("DeployModule", (m) => {
    const { usd, drop } = m.useModule(TokenDrop)

    return { usd, drop };
});

export default DeployModule;
