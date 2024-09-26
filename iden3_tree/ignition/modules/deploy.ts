import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TreeModule = buildModule("TreeModule", (m) => {
    const smt = m.library("SmtLib");

    const snapshot = m.contract("TokenSnapshot", [160],
        { libraries: { SmtLib: smt } });

    return { smt, snapshot };
});

export default TreeModule;
