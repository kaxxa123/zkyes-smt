import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { expect } from 'chai';

const TREE_DEPTH = 160;

describe("Inverted traveral test", function () {

    async function deployTreeTest() {
        const MyKeccak2LFactory = await ethers.getContractFactory("MyKeccak2L");
        const MyKeccak3LFactory = await ethers.getContractFactory("MyKeccak3L");
        const hash2 = await MyKeccak2LFactory.deploy();
        const hash3 = await MyKeccak3LFactory.deploy();

        const SmtLibFactory = await ethers.getContractFactory("SmtLib", {
            libraries: {
                PoseidonUnit2L: await hash2.getAddress(),
                PoseidonUnit3L: await hash3.getAddress(),
            },
        });
        const smtlib = await SmtLibFactory.deploy();

        // Initialze tree with 20-byte/160-bit leaf addresses
        // Matching the ethereum address space.
        const TreeFactory = await ethers.getContractFactory("TokenSnapshot", {
            libraries: {
                SmtLib: smtlib,
            },
        });
        const tree = await TreeFactory.deploy(TREE_DEPTH);

        return { tree, hash2, hash3 };
    }

    function normalize32Bytes(input: string): string {
        if (input.length === 0)
            return "";

        if (input.length % 64 == 0)
            return input;

        // Add enough zeros to make the hash a multiple of 32-bytes
        return input.padStart(64 + input.length - (input.length % 64), '0')
    }

    it("Should deploy empty tree that fits all ETH addresses", async function () {
        const { tree } = await loadFixture(deployTreeTest);

        expect(await tree.getMaxDepth()).to.equal(TREE_DEPTH);
        expect(await tree.getRoot()).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Should correctly add one leaf.", async function () {
        const { tree, hash2, hash3 } = await loadFixture(deployTreeTest);

        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        const root = "0x" + (await tree.getRoot()).toString(16)

        // Compute leaf hash
        const h0 = await hash3.poseidon([
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])

        // Confirm root match
        expect(root).to.equal(h0)
    });

    it("Should add two leaves.", async function () {
        const { tree, hash2, hash3 } = await loadFixture(deployTreeTest);

        // Address = 1111...0110
        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        // Address = 0011...1100
        await tree.recordBalance('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 5n * 10n ** 18n)
        const root = "0x" + (await tree.getRoot()).toString(16)

        // Compute leaf hashes
        const h0 = await hash3.poseidon([
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])

        const h1 = await hash3.poseidon([
            "0x0000000000000000000000003C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])

        // Compute regular traversal root
        const regularRoot = await hash2.poseidon([h1, h0]);

        // Confirm root NOT match
        expect(root).to.not.equal(regularRoot)

        // Compute expected (reverse traversal) root
        // Compute the root based on "reversed address" traversal
        //  Current: 1111...0 1 1 0
        //  New:     0011...1 1 0 0
        //                      | |-- Traverse left, Right = Current_Sibling (Zero)
        //                      |---- Traverse left, Right = Current_Sibling (h0)
        // Hash(Hash(h1 | h0) | 0)
        const zero = "0x0000000000000000000000000000000000000000000000000000000000000000"
        const reverseRoot = await hash2.poseidon([regularRoot, zero]);

        // Confirm root match
        expect(root).to.equal(reverseRoot)

        console.log(`Regular traversal root: ${regularRoot}`)
        console.log(`Reverse traversal root: ${reverseRoot}`)
    });

    it("Should add two leaves.", async function () {
        const { tree, hash2, hash3 } = await loadFixture(deployTreeTest);

        // Address = 1111...0110
        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        // Address = 0001...0101
        await tree.recordBalance('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', 5n * 10n ** 18n)
        const root = "0x" + (await tree.getRoot()).toString(16)

        // Compute leaf hashes
        const h0 = await hash3.poseidon([
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])

        const h1 = await hash3.poseidon([
            "0x00000000000000000000000015d34AAf54267DB7D7c367839AAf71A00a2C6A65",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])

        // Compute regular traversal root
        const regularRoot = await hash2.poseidon([h1, h0]);

        // Confirm root NOT match
        expect(root).to.not.equal(regularRoot)

        // Compute expected (reverse traversal) root
        // Compute the root based on "reversed address"
        //  Current: 1111...0 1 1 0
        //  New:     0011...0 1 0 1
        //                        |-- Traverse right, Left = Current_Sibling (h0)
        // Hash(h0 | h1)
        const reverseRoot = await hash2.poseidon([h0, h1]);

        // Confirm root match
        expect(root).to.equal(reverseRoot)

        console.log(`Regular traversal root: ${regularRoot}`)
        console.log(`Reverse traversal root: ${reverseRoot}`)
    });

    it("Should add ten leaves.", async function () {
        const { tree, hash2, hash3 } = await loadFixture(deployTreeTest);

        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        await tree.recordBalance('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 6n * 10n ** 18n)
        await tree.recordBalance('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 7n * 10n ** 18n)
        await tree.recordBalance('0x90F79bf6EB2c4f870365E785982E1f101E93b906', 8n * 10n ** 18n)
        await tree.recordBalance('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', 9n * 10n ** 18n)
        await tree.recordBalance('0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', 10n * 10n ** 18n)
        await tree.recordBalance('0x976EA74026E726554dB657fA54763abd0C3a0aa9', 11n * 10n ** 18n)
        await tree.recordBalance('0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', 12n * 10n ** 18n)
        await tree.recordBalance('0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', 13n * 10n ** 18n)
        await tree.recordBalance('0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', 14n * 10n ** 18n)
        const root = "0x" + normalize32Bytes((await tree.getRoot()).toString(16))

        const expectedRoot = "0x061b97353fab86ebc788e280af3b1c7ed983fad17fbfd6b23ff1b8a153a7fd51";

        console.log(`Expected: ${expectedRoot}`)
        console.log(`Actual:   ${root}`)

        // Confirm root match
        expect(root).to.equal(expectedRoot)
    });
});
