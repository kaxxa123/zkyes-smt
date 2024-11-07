import { ethers } from "ethers";
import { buildPoseidon, Poseidon } from "circomlibjs";
import { SMTMemDb, buildSMT } from "circomlibjs";

import { LOG_LEVEL, buildSMTSingleLeafEx, HashFn } from "zkyes-smt"

const LEVEL = 5n;

function RandomNum(max: number): number {
    return Math.floor(Math.random() * (max + 1));
}

function getHashFn(poseidonHash: Poseidon | undefined): HashFn {
    const HashKeccak256 = async (preimage: string) => ethers.keccak256("0x" + preimage).slice(2);
    if (poseidonHash === undefined)
        return HashKeccak256;

    const HashPoseidon = async (preimage: string) => {
        // Preimage cannot be empty and must be in 32-byte chunks
        if ((preimage.length == 0) || (preimage.length % 64 != 0))
            throw "Poseidon: A preimage of 32-byte chunks is required.";

        // Hash uint256 values
        const hashU256 = (): Uint8Array => {
            //break pre-image in 32-byte chunks
            const chunks: bigint[] = [];
            for (let pos = 0; pos < preimage.length;) {
                chunks.push(BigInt("0x" + preimage.slice(pos, pos + 64)))
                pos += 64;
            }

            return poseidonHash(chunks);
        }

        // Hash 32-byte blobs
        const hashBytes = (): Uint8Array => {
            //break pre-image in 32-byte chunks
            const chunks: Uint8Array[] = [];
            for (let pos = 0; pos < preimage.length;) {
                const buffer = Buffer.from(preimage.slice(pos, pos + 64), 'hex');
                chunks.push(new Uint8Array(buffer))
                pos += 64;
            }

            return poseidonHash(chunks)
        }

        // SMTSingleLeafEx is special in that leaf hashes are computed
        // over uint256 values rather than 32-byte blobs. We identify this
        // special case from the preimage size.
        let hashOut = (preimage.length === 64 * 3) ? hashU256() : hashBytes();
        if (hashOut.length != 32)
            throw `Poseidon Hash unexpected length: ${hashOut.length}`;

        // Encode byte array into a hex string
        return Array.from(hashOut)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }
    return HashPoseidon;
}

async function mainTest(poseidon: Poseidon) {

    const smtDB = new SMTMemDb(poseidon.F)
    const tree0 = await buildSMT(smtDB, smtDB.root)

    const hashFn = getHashFn(poseidon);
    const tree1 = await buildSMTSingleLeafEx(hashFn, LEVEL, false, LOG_LEVEL.LOW);

    const MAX = Number(tree1.upperIndex());

    for (let pos = 0; pos < MAX * 10; ++pos) {
        let address = BigInt(RandomNum(MAX));
        let value = BigInt(RandomNum(MAX));

        console.log("==================================================================");
        let update = (await tree0.find(address))?.found === true;
        console.log(`${pos}. ${(update ? "Updating" : "Adding")} leaf ${address} | value ${value}`)

        let leaf0 = update ?
            await tree0.update(address, value) :
            await tree0.insert(address, value);

        let root0 = "";
        if (tree0.root instanceof Uint8Array) {
            root0 = Array.from(tree0.root).map(byte => byte.toString(16).padStart(2, '0')).join('');
        }

        let leaf1 = await tree1.addLeaf(address, value.toString(16))

        console.log(`${pos}. Root after ${(update ? "updating" : "adding")} leaf ${address} : ${tree1.ROOT()}`)
        console.log();

        if (root0 !== tree1.ROOT())
            throw "Roots did not match!";
    }
}

async function main() {
    let poseidon = await buildPoseidon();
    await mainTest(poseidon);

    console.log()
    console.log("All tests succeeded")
    console.log()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.log()
    console.log("Failed!")
    console.error(error);
    console.log()
    process.exitCode = 1;
});
