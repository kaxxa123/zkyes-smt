import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Keccak256Module = buildModule("Keccak256Module", (m) => {
    const keccak2 = m.library("MyKeccak2L");
    const keccak3 = m.library("MyKeccak3L");

    return { keccak2, keccak3 };
});

export default Keccak256Module;
