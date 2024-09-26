import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { expect } from 'chai';

const TREE_DEPTH = 160;

describe("Incorrect Traveral Test", function () {

    async function deployTreeTest() {
        // Deploy an SMT with depth of 160 such that to have 
        // a leaf for each possible Ethereum address
        const SmtLibFactory = await ethers.getContractFactory("SmtLib");
        const smtlib = await SmtLibFactory.deploy();

        const TreeFactory = await ethers.getContractFactory("TokenSnapshot", {
            libraries: {
                SmtLib: smtlib,
            },
        });
        // Initialze tree with 20-byte/160-bit leaf addresses
        // Matching the ethereum address space.
        const tree = await TreeFactory.deploy(TREE_DEPTH);

        return { tree };
    }

    it("Should deploy empty tree that fits all ETH addresses", async function () {
        const { tree } = await loadFixture(deployTreeTest);

        expect(await tree.getMaxDepth()).to.equal(TREE_DEPTH);
        expect(await tree.getRoot()).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Should correctly add one leaf.", async function () {
        const { tree } = await loadFixture(deployTreeTest);

        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        const root = "0x" + (await tree.getRoot()).toString(16)

        // Compute leaf hash
        const h0 = await tree.hash3(
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001")

        // Confirm root match
        expect(root).to.equal(h0)
    });

    it("Should incorrectly add two leaves.", async function () {
        const { tree } = await loadFixture(deployTreeTest);

        // Address = 1111...0110
        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        // Address = 0011...1100
        await tree.recordBalance('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 5n * 10n ** 18n)
        const root = "0x" + (await tree.getRoot()).toString(16)

        // Compute leaf hashes
        const h0 = await tree.hash3(
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001")

        const h1 = await tree.hash3(
            "0x0000000000000000000000003C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001")

        // Compute correct root
        const correctRoot = await tree.hash2(h1, h0);

        // Confirm root NOT match
        expect(root).to.not.equal(correctRoot)

        // Compute expected (incorrect) root
        // Compute the root based on "reversed address" traversal
        //  Current: 1111...0 1 1 0
        //  New:     0011...1 1 0 0
        //                      | |-- Traverse left, Right = Current_Sibling (Zero)
        //                      |---- Traverse left, Right = Current_Sibling (h0)
        // Hash(Hash(h1 | h0) | 0)
        const zero = "0x0000000000000000000000000000000000000000000000000000000000000000"
        const expectedRoot = await tree.hash2(correctRoot, zero);

        // Confirm root match
        expect(root).to.equal(expectedRoot)

        console.log(`Correct  Root: ${correctRoot}`)
        console.log(`Expected Root: ${expectedRoot}`)
    });

    it("Should incorrectly add two leaves.", async function () {
        const { tree } = await loadFixture(deployTreeTest);

        // Address = 1111...0110
        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        // Address = 0001...0101
        await tree.recordBalance('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', 5n * 10n ** 18n)
        const root = "0x" + (await tree.getRoot()).toString(16)

        // Compute leaf hashes
        const h0 = await tree.hash3(
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001")

        const h1 = await tree.hash3(
            "0x00000000000000000000000015d34AAf54267DB7D7c367839AAf71A00a2C6A65",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001")

        // Compute correct root
        const correctRoot = await tree.hash2(h1, h0);

        // Confirm root NOT match
        expect(root).to.not.equal(correctRoot)

        // Compute expected (incorrect) root
        // Compute the root based on "reversed address"
        //  Current: 1111...0 1 1 0
        //  New:     0011...0 1 0 1
        //                        |-- Traverse right, Left = Current_Sibling (h0)
        // Hash(h0 | h1)
        const expectedRoot = await tree.hash2(h0, h1);

        // Confirm root match
        expect(root).to.equal(expectedRoot)

        console.log(`Correct  Root: ${correctRoot}`)
        console.log(`Expected Root: ${expectedRoot}`)
    });
});
