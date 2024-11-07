import { ethers } from "ethers";
import { buildPoseidon, Poseidon } from "circomlibjs";
import { LOG_LEVEL, IMerkle, buildSMTSingleLeafEx, HashFn } from "zkyes-smt"

const LEVEL = 4n;

type TreeOp = {
    index: number,
    value: number,
    leaf: string,
    root: string
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

async function testTree(tree: IMerkle, treeOpList: TreeOp[]) {

    for (let pos = 0; pos < treeOpList.length; ++pos) {
        let op = treeOpList[pos];
        let leaf = await tree.addLeaf(BigInt(op.index), op.value.toString(16));

        console.log(`${pos}. Root after adding leaf ${op.index} : ${tree.ROOT()}`)
        console.log()

        if (op.leaf !== leaf)
            throw `Leaves added did not match! ${leaf}`;

        if (op.root !== tree.ROOT())
            throw `Root did not match! ${tree.ROOT()}`;
    }
}

async function testKeccak256() {
    const tree = await buildSMTSingleLeafEx(getHashFn(undefined), LEVEL, false, LOG_LEVEL.HIGH);

    let treeOpList = [
        { index: 2, value: 2, leaf: "0073d82a0d9fd31516bcedd1585b7ad7fd372b24932440dfa5bc139ff61f78c1", root: "0073d82a0d9fd31516bcedd1585b7ad7fd372b24932440dfa5bc139ff61f78c1" },
        { index: 10, value: 10, leaf: "c882b94dd5fd35f6289607ae6bb308cf74190af7426ed4083080baf87366944c", root: "2c79e2306835b52b48a516dc16c86ef2b03010e6d84383cf4e10d8e6f365870c" },
        { index: 8, value: 0x33, leaf: "dc8f9e4768524e0e71212ce8580962a52d9e18e81a8c543fca600f0a71836839", root: "cf6be1c47ea02a7c90758e85e3485fc6ff0852f1587494b6446f4323c2681623" },
        { index: 13, value: 13, leaf: "3eb13aa90e94d819a946905d93d5cc9c714e9440793b7588f7c8e8b8f4aa824e", root: "30051ff243a1fbd7b21c0571ea0a4339fdd0a4e990e512f665bf46917d6ad1ea" },
        { index: 5, value: 0x55, leaf: "2c094a3ff99b92af838d83558b31d7ce05dfc8680542b169d91a4693a14f3909", root: "92c31d6ccf2f12c2a699063cf40b2a3642fc25a6e111217f25f68b42ea8096bb" }];

    await testTree(tree, treeOpList);
}

async function testPoseidon() {
    const tree = await buildSMTSingleLeafEx(getHashFn(await buildPoseidon()), LEVEL, false, LOG_LEVEL.HIGH);

    let treeOpList = [
        { index: 2, value: 2, leaf: "65b161eb36c1413237d4f582b76c6089245f184c9ab57bd938ba79a33cf27524", root: "65b161eb36c1413237d4f582b76c6089245f184c9ab57bd938ba79a33cf27524" },
        { index: 10, value: 10, leaf: "8df8d7a55075c069355806ef54fde146e1cb9381e3631da8c3089b0f535eea1f", root: "b7a550dba9b9f44c826eedf8bb4cd1888a4a397f002f06f9ebb9ffb38d9d7520" },
        { index: 8, value: 0x33, leaf: "3d64ebe05355652829b10016a7863e6cb3853f38c0f504acc1cc7e07fb1aa72c", root: "303f4d0feb31d242d350160034704bf6b20d8afe09fc5b95438073ef01bd5622" },
        { index: 13, value: 13, leaf: "a9359b53ac10b93c466009333e65716974ea34e040a722c07972d3c897145402", root: "9664fe4ca457116f6bd8899c86a71432f559999492d737cf429f3121a084cd12" },
        { index: 5, value: 0x55, leaf: "875b8c4dc8f58c78121e4fcb927c1e0abef257a15a60c53dc8ef436f58f43c15", root: "666d9f3b45015f041095c6c0f7d06664735e9f1515e85327f346eb08389da105" }];

    await testTree(tree, treeOpList);
}

async function main() {
    await testKeccak256();
    await testPoseidon();

    console.log()
    console.log("All tests succeeded")
    console.log()
}

main().catch((error) => {
    console.log()
    console.log("Failed!")
    console.error(error);
    console.log()
    process.exitCode = 1;
});
