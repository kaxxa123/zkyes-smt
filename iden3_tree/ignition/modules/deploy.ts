import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import Keccak256Module from "./hash_keccak256";

const TreeModule = buildModule("TreeModule", (m) => {
    const { keccak2, keccak3 } = m.useModule(Keccak256Module);

    const smt = m.library("SmtLib",
        {
            libraries: {
                PoseidonUnit2L: keccak2,
                PoseidonUnit3L: keccak3
            }
        })

    const snapshot = m.contract("TokenSnapshot", [160],
        {
            libraries: {
                SmtLib: smt
            }
        });

    return { smt, snapshot, keccak2, keccak3 };
});

export default TreeModule;
