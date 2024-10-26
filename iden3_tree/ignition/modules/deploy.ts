import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import * as dotenv from "dotenv";
dotenv.config();

const hashKeccak256 = process.env.HASH_KECCAK256 === "true";

const TreeModule = buildModule("TreeModule", (m) => {
    const poseidon2 = m.library("MyPoseidon2L");
    const poseidon3 = m.library("MyPoseidon3L");
    const keccak2 = m.library("MyKeccak2L");
    const keccak3 = m.library("MyKeccak3L");

    const smt = m.library("SmtLib",
        {
            libraries: {
                PoseidonUnit2L: hashKeccak256 ? keccak2 : poseidon2,
                PoseidonUnit3L: hashKeccak256 ? keccak3 : poseidon3
            }
        })

    const snapshot = m.contract("TokenSnapshot", [160],
        {
            libraries: {
                SmtLib: smt
            }
        });

    return { smt, snapshot, poseidon2, poseidon3, keccak2, keccak3 };
});

export default TreeModule;
