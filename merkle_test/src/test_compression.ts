import { ethers } from "ethers";
import { buildPoseidon, Poseidon } from "circomlibjs";
import { SMTNaive, SMTHashZero, SMTSingleLeaf, SMTSingleLeafEx } from "zkyes-smt"
import { compressPoM, decompressPoM, PoM, IMerkle, HashFn } from "zkyes-smt"

const LEVEL = 5n;
const SORT_MODE = false;

function RandomNum(max: number): number {
    return Math.floor(Math.random() * (max + 1));
}

function displayPoM(proof: PoM) {
    console.log()
    console.log(`Proof:`)
    console.log(` Compressed: ${proof.compress ? proof.compress.toString(2) : "NO"}`)
    console.log(`       Root: ${proof.root}`)
    console.log(`       Leaf: ${proof.leaf}`)
    console.log("   Siblings: [(root+1) to leaf]");

    proof.siblings.forEach((hash, idx) => {
        console.log(`      hash[${idx}] = ${hash}`)
    })
}

function verifyCompression(smt: IMerkle, decompressed: PoM, alwaysLog: boolean = false): boolean {

    let compressed = compressPoM(smt, decompressed);
    let decompressed2 = decompressPoM(smt, compressed);
    let ret = false;

    try {
        if (decompressed.siblings.length != decompressed2.siblings.length)
            return ret;

        for (let pos = decompressed.siblings.length - 1; pos >= 0; --pos)
            if (decompressed.siblings[pos] !== decompressed2.siblings[pos])
                return ret;

        ret = true;
    }
    finally {
        if (!ret || alwaysLog) {
            console.log()
            console.log(ret ? "SUCCESS" : "FAILED")
            displayPoM(decompressed)
            console.log()
            displayPoM(compressed)
            console.log()
            displayPoM(decompressed2)
        }
    }

    return ret;
}

function fuzzTest(tree: IMerkle, repetitions: number | undefined = undefined) {
    const MAX = Number(tree.upperIndex());
    let alwaysLog = false;

    if (repetitions == undefined) repetitions = MAX * 10;
    else alwaysLog = true;

    for (let pos = 0; pos < repetitions; ++pos) {
        let addrAdd = RandomNum(MAX);
        let addrProof = RandomNum(MAX);

        console.log("==================================================================");
        console.log(`${pos}. Adding leaf ${addrAdd}`)
        let leaf = tree.addLeaf(BigInt(addrAdd), addrAdd.toString(16))

        console.log(`${pos}. Root after adding leaf ${addrAdd} : ${tree.ROOT()}`)

        console.log(`${pos}. Proving leaf ${addrProof}`)
        let proof = tree.getProof(BigInt(addrProof));

        if (!verifyCompression(tree, proof, alwaysLog))
            throw "Compression failed!"

        console.log();
    }
}

function getHashFn(poseidonHash: Poseidon | undefined): HashFn {
    const HashKeccak256 = (preimage: string) => ethers.keccak256("0x" + preimage).slice(2);
    if (poseidonHash === undefined)
        return HashKeccak256;

    const HashPoseidon = (preimage: string) => {
        // Preimage cannot be empty and must be in 32-byte chunks
        if ((preimage.length == 0) || (preimage.length % 64 != 0))
            throw "Poseidon: A preimage of 32-byte chunks is required.";

        //break pre-image in 32-byte chunks
        const chunks: bigint[] = [];
        for (let pos = 0; pos < preimage.length;) {
            chunks.push(BigInt("0x" + preimage.slice(pos, pos + 64)))
            pos += 64;
        }

        let hashOut = poseidonHash(chunks);
        if (hashOut.length != 32)
            throw `Poseidon Hash unexpected length: ${hashOut.length}`;

        // Encode byte array into a hex string
        return Array.from(hashOut)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }
    return HashPoseidon;
}

function mainTest(short: boolean, poseidon: Poseidon | undefined) {

    let hashFn = getHashFn(poseidon);

    fuzzTest(new SMTNaive(hashFn, LEVEL, SORT_MODE), short ? 10 : undefined);
    console.log("Completed SMTNaive test")

    fuzzTest(new SMTHashZero(hashFn, LEVEL, SORT_MODE), short ? 10 : undefined);
    console.log("Completed SMTHashZero test")

    fuzzTest(new SMTSingleLeaf(hashFn, LEVEL, SORT_MODE), short ? 10 : undefined);
    console.log("Completed SMTSingleLeaf test")

    fuzzTest(new SMTSingleLeafEx(hashFn, LEVEL, SORT_MODE), short ? 10 : undefined);
    console.log("Completed SMTSingleLeafEx test")
}

async function main() {
    let poseidon = await buildPoseidon();
    mainTest(false, undefined);
    mainTest(true, undefined);
    mainTest(false, poseidon);
    mainTest(true, poseidon);

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
