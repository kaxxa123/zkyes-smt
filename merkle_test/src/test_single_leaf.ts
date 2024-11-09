// SMTSingleLeaf and SMTHashZero should always produce the same root.
// The two implementations only differ in how they store the tree.
//
// Randomly add/remove tree leaves and check that the roots always match.

import { ethers } from "ethers";
import { buildPoseidon, Poseidon } from "circomlibjs";
import { Poseidon as SmartPoseidon } from "@iden3/js-crypto";
import { LOG_LEVEL, buildSMTHashZero, buildSMTSingleLeaf, HashFn } from "zkyes-smt"

const LEVEL = 5n;
const SORT_MODE = false;

function RandomNum(max: number): number {
    return Math.floor(Math.random() * (max + 1));
}

enum HASH_MODE {
    Keccak256,
    Poseidon,           // Circomlibjs Poseidon
    SmartPoseidon,      // JS-crypto Poseidon
}

function normalize32Bytes(input: string): string {
    if (input.length === 0)
        return "";

    if (input.length % 64 == 0)
        return input;

    // Add enough zeros to make the hash a multiple of 32-bytes
    return input.padStart(64 + input.length - (input.length % 64), '0')
}

function getHashFn(hashType: HASH_MODE, poseidonHash: Poseidon): HashFn {
    const HashKeccak256 = async (preimage: string) => ethers.keccak256("0x" + preimage).slice(2);

    const HashSmartPoseidon = async (preimage: string) => {
        if ((preimage.length === 0) || (preimage.length % 64 !== 0))
            throw "preimage length must be multiple of 32-bytes";

        const chunks: bigint[] = [];
        for (let pos = 0; pos < preimage.length;) {
            chunks.push(BigInt("0x" + preimage.slice(pos, pos + 64)))
            pos += 64;
        }

        // The @iden3/js-crypto (unlike circomlibjs) generates the same 
        // hash as the EVM Poseidon libraries.
        let hash = SmartPoseidon.hash(chunks);

        return normalize32Bytes(hash.toString(16));
    }

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

    if (hashType === HASH_MODE.Keccak256)
        return HashKeccak256;

    else if (hashType === HASH_MODE.SmartPoseidon)
        return HashSmartPoseidon;

    else if (hashType === HASH_MODE.Poseidon)
        return HashPoseidon;

    throw `Unknown hash type ${hashType}`;
}

// If we identify a problematic sequence we can reproduce it here...
async function reproduce() {

    const HashKeccak256 = async (preimage: string) => ethers.keccak256("0x" + preimage).slice(2);
    const tree0 = await buildSMTHashZero(HashKeccak256, LEVEL, SORT_MODE);
    const tree1 = await buildSMTSingleLeaf(HashKeccak256, LEVEL, SORT_MODE, LOG_LEVEL.LOW);

    let addrList = [[2, true], [3, true], [3, true]];

    for (let pos = 0; pos < addrList.length; ++pos) {
        let addr = addrList[pos];
        let leaf0 = await tree0.addLeaf(BigInt(addr[0]), addr[1] ? addr[0].toString(16) : tree0.ZERO_LEAF_VALUE());
        let leaf1 = await tree1.addLeaf(BigInt(addr[0]), addr[1] ? addr[0].toString(16) : tree1.ZERO_LEAF_VALUE());

        console.log(`${pos}. Root after ${(addr[1] ? "adding" : "removing")} leaf ${addr[0]} : ${tree1.ROOT()}`)
        console.log()

        if (leaf0 !== leaf1)
            throw "Leaves added/removed did not match!";

        if (tree0.ROOT() !== tree1.ROOT())
            throw "Roots did not match!";
    }
}

async function mainTest(hashType: HASH_MODE) {

    const hashFn = getHashFn(hashType, await buildPoseidon());
    const tree0 = await buildSMTHashZero(hashFn, LEVEL, SORT_MODE);
    const tree1 = await buildSMTSingleLeaf(hashFn, LEVEL, SORT_MODE, LOG_LEVEL.LOW);
    const MAX = Number(tree1.upperIndex());

    for (let pos = 0; pos < MAX * 10; ++pos) {
        let address = RandomNum(MAX);
        let add_remove = (RandomNum(1) == 1);

        console.log("==================================================================");
        console.log(`${pos}. ${(add_remove ? "Adding" : "Removing")} leaf ${address}`)

        let leaf0 = await tree0.addLeaf(BigInt(address), add_remove ? address.toString(16) : tree0.ZERO_LEAF_VALUE())
        let leaf1 = await tree1.addLeaf(BigInt(address), add_remove ? address.toString(16) : tree1.ZERO_LEAF_VALUE())

        console.log(`${pos}. Root after ${(add_remove ? "adding" : "removing")} leaf ${address} : ${tree1.ROOT()}`)
        console.log();

        if (leaf0 !== leaf1)
            throw "Leaves added/removed did not match!";

        if (tree0.ROOT() !== tree1.ROOT())
            throw "Roots did not match!";
    }
}

async function main() {
    await mainTest(HASH_MODE.Keccak256);
    await mainTest(HASH_MODE.Poseidon);
    await mainTest(HASH_MODE.SmartPoseidon);

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
