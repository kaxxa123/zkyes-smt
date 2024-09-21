// SMTSingleLeaf and SMTHashZero should always produce the same root.
// The two implementations only differ in how they store the tree.
//
// Randomly add/remove tree leaves and check that the roots always match.

import { SMTHashZero } from '../trees/merkle_h0'
import { SMTSingleLeaf } from '../trees/merkle_single_leaf'

const LEVEL = 5n;
const SORT_MODE = false;

const tree0 = new SMTHashZero(LEVEL, SORT_MODE);
const tree1 = new SMTSingleLeaf(LEVEL, SORT_MODE, 1);
const MAX = Number(tree1.upperIndex());

function RandomNum(max: number): number {
    return Math.floor(Math.random() * (max + 1));
}


// If we identify a problematic sequence we can reproduce it here...
function reproduce() {

    let addrList = [[2, true], [3, true], [3, true]];

    addrList.forEach((addr, pos) => {
        let leaf0 = tree0.addLeaf(BigInt(addr[0]), addr[1] ? addr[0].toString(16) : tree0.ZERO_LEAF_VALUE());
        let leaf1 = tree1.addLeaf(BigInt(addr[0]), addr[1] ? addr[0].toString(16) : tree1.ZERO_LEAF_VALUE());

        console.log(`${pos}. Root after ${(addr[1] ? "adding" : "removing")} leaf ${addr[0]} : ${tree1.ROOT()}`)

        if (leaf0 !== leaf1)
            throw "Leaves added/removed did not match!";

        if (tree0.ROOT() !== tree1.ROOT())
            throw "Roots did not match!";
    })
}

function main() {

    for (let pos = 0; pos < MAX * 10; ++pos) {
        let address = RandomNum(MAX);
        let add_remove = (RandomNum(1) == 1);

        console.log("==================================================================");
        console.log(`${pos}. ${(add_remove ? "Adding" : "Removing")} leaf ${address}`)

        let leaf0 = tree0.addLeaf(BigInt(address), add_remove ? address.toString(16) : tree0.ZERO_LEAF_VALUE())
        let leaf1 = tree1.addLeaf(BigInt(address), add_remove ? address.toString(16) : tree1.ZERO_LEAF_VALUE())

        console.log(`${pos}. Root after ${(add_remove ? "adding" : "removing")} leaf ${address} : ${tree1.ROOT()}`)
        console.log();

        if (leaf0 !== leaf1)
            throw "Leaves added/removed did not match!";

        if (tree0.ROOT() !== tree1.ROOT())
            throw "Roots did not match!";
    }
}

main();