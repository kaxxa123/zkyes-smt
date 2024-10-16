import { ethers } from "ethers";
import { LOG_LEVEL, SMTSingleLeafEx } from "zkyes-smt"

const LEVEL = 4n;
const HashKeccak256 = (preimage: string) => ethers.keccak256("0x" + preimage).slice(2);
const tree = new SMTSingleLeafEx(HashKeccak256, LEVEL, false, LOG_LEVEL.HIGH);

function reproduce() {

    let addrList = [
        [2, 2, "0073d82a0d9fd31516bcedd1585b7ad7fd372b24932440dfa5bc139ff61f78c1"],
        [10, 10, "c882b94dd5fd35f6289607ae6bb308cf74190af7426ed4083080baf87366944c"],
        [8, 0x33, "dc8f9e4768524e0e71212ce8580962a52d9e18e81a8c543fca600f0a71836839"],
        [13, 13, "3eb13aa90e94d819a946905d93d5cc9c714e9440793b7588f7c8e8b8f4aa824e"],
        [5, 0x55, "2c094a3ff99b92af838d83558b31d7ce05dfc8680542b169d91a4693a14f3909"]];

    addrList.forEach((addr, pos) => {
        let leaf = tree.addLeaf(BigInt(addr[0]), addr[1].toString(16));

        console.log(`${pos}. Root after ${(addr[1] ? "adding" : "removing")} leaf ${addr[0]} : ${tree.ROOT()}`)
        console.log()

        if (addr[2] !== leaf)
            throw `Leaves added/removed did not match! ${leaf}`;
    })
}

reproduce();