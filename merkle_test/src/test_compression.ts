import { ethers } from "ethers";
import { SMTNaive, SMTHashZero, SMTSingleLeaf, SMTSingleLeafEx } from "zkyes-smt"
import { compressPoM, decompressPoM, PoM, IMerkle } from "zkyes-smt"

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

function HashKeccak256(preimage: string): string {
    return ethers.keccak256("0x" + preimage).slice(2)
}

function main(short: boolean = false) {
    fuzzTest(new SMTNaive(HashKeccak256, LEVEL, SORT_MODE), short ? 10 : undefined);
    console.log("Completed SMTNaive test")

    fuzzTest(new SMTHashZero(HashKeccak256, LEVEL, SORT_MODE), short ? 10 : undefined);
    console.log("Completed SMTHashZero test")

    fuzzTest(new SMTSingleLeaf(HashKeccak256, LEVEL, SORT_MODE), short ? 10 : undefined);
    console.log("Completed SMTSingleLeaf test")

    fuzzTest(new SMTSingleLeafEx(HashKeccak256, LEVEL, SORT_MODE), short ? 10 : undefined);
    console.log("Completed SMTSingleLeafEx test")
}

main(false);
main(true);