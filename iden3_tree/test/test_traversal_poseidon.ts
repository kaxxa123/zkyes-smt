import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { expect } from 'chai';

import { poseidonContract, buildPoseidon } from "circomlibjs";

const TREE_DEPTH = 160;

describe("Inverted traveral test", function () {

    async function deployPoseidon() {
        const codePoseidon2 = poseidonContract.createCode(2);
        const codePoseidon3 = poseidonContract.createCode(3);

        const accounts = await ethers.getSigners()
        let trn = await accounts[0].sendTransaction({ to: null, data: codePoseidon2 })
        let receipt = await trn.provider.getTransactionReceipt(trn.hash)
        if (typeof receipt?.contractAddress !== "string")
            throw "Failed on installig Poseidon2 contract";

        const addr2: string = receipt.contractAddress
        console.log(`Poseidon2 Library ${addr2}`)

        trn = await accounts[0].sendTransaction({ to: null, data: codePoseidon3 })
        receipt = await trn.provider.getTransactionReceipt(trn.hash)
        if (typeof receipt?.contractAddress !== "string")
            throw "Failed on installig Poseidon3 contract";

        const addr3 = receipt.contractAddress
        console.log(`Poseidon3 Library ${addr3}`)

        return { addr2, addr3 };
    }

    async function deployTreeTest() {

        const { addr2: pa2, addr3: pa3 } = await deployPoseidon();

        const PoseidonUnit2LFactory = await ethers.getContractFactory("PoseidonUnit2L");
        const PoseidonUnit3LFactory = await ethers.getContractFactory("PoseidonUnit3L");
        const hash2 = PoseidonUnit2LFactory.attach(pa2);
        const hash3 = PoseidonUnit3LFactory.attach(pa3);

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

    function BigInt2Hex(input: BigInt): string {
        return "0x" + normalize32Bytes((input).toString(16));
    }

    async function contract_to_js_hash(hashin: BigInt): Promise<string> {
        let jsPosiedon = await buildPoseidon()
        let hashin_a: Uint8Array = jsPosiedon.F.e(hashin)
        let hashin_b: string = Array.from(hashin_a).map(byte => byte.toString(16).padStart(2, '0')).join('')

        return "0x" + normalize32Bytes(hashin_b)
    }

    it("Should deploy empty tree that fits all ETH addresses", async function () {
        const { tree } = await loadFixture(deployTreeTest);

        expect(await tree.getMaxDepth()).to.equal(TREE_DEPTH);
        expect(await tree.getRoot()).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Simple on-chain/off-chain hashes should match", async function () {
        const { tree, hash2, hash3 } = await loadFixture(deployTreeTest);

        // Compute on-chain hashes
        let h11: BigInt = await hash2.poseidon([1, 1])
        let h111: BigInt = await hash3.poseidon([1, 1, 1])
        let sh11: string = await contract_to_js_hash(h11)
        let sh111: string = await contract_to_js_hash(h111)
        console.log(`Hash(1,1) = ${sh11}`)
        console.log(`Hash(1,1,1) = ${sh111}`)

        // Compute off-chain hashes
        let jsPosiedon = await buildPoseidon()
        let jsh11 = jsPosiedon([1, 1])
        let sjsh11 = "0x" + Array.from(jsh11).map(byte => byte.toString(16).padStart(2, '0')).join('')

        let jsh111 = jsPosiedon([1, 1, 1])
        let sjsh111 = "0x" + Array.from(jsh111).map(byte => byte.toString(16).padStart(2, '0')).join('')

        expect(sjsh11).to.be.equal(sh11)
        expect(sjsh111).to.be.equal(sh111)
    });

    it("Should correctly add one leaf.", async function () {
        const { tree, hash2, hash3 } = await loadFixture(deployTreeTest);

        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)

        const nRoot = await tree.getRoot()
        const sRoot = await contract_to_js_hash(nRoot)
        const root = BigInt2Hex(nRoot)

        console.log(`Tree Root (original):  ${root}`);
        console.log(`Tree Root (corrected): ${sRoot}`);

        // Compute leaf hash on-chain
        const h0 = await hash3.poseidon([
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])

        // Compute leaf hash off-chain
        let jsPosiedon = await buildPoseidon()
        let jsh0 = jsPosiedon([
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])
        let sjsh0 = "0x" + Array.from(jsh0).map(byte => byte.toString(16).padStart(2, '0')).join('')

        // Confirm root match
        expect(root).to.equal(h0)
        expect(sRoot).to.equal(sjsh0)
    });

    it("Should add two leaves.", async function () {
        const { tree, hash2, hash3 } = await loadFixture(deployTreeTest);

        // Address = 1111...0110
        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        // Address = 0011...1100
        await tree.recordBalance('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 5n * 10n ** 18n)

        const nRoot = await tree.getRoot()
        const sRoot = await contract_to_js_hash(nRoot)
        const root = BigInt2Hex(nRoot)

        console.log(`Tree Root (original):  ${root}`);
        console.log(`Tree Root (corrected): ${sRoot}`);
        console.log()

        // Compute leaf hashes  on-chain
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

        console.log("On-Chain values:")
        console.log(`h0                  = ${BigInt2Hex(h0)}`)
        console.log(`h1                  = ${BigInt2Hex(h1)}`)
        console.log(`Hash(h1,h0)         = ${BigInt2Hex(regularRoot)}`)
        console.log(`Hash(Hash(h1,h0),0) = ${BigInt2Hex(reverseRoot)}`)
        console.log()

        // Compute off-chain hashes
        let jsPosiedon = await buildPoseidon()
        let jsh0 = jsPosiedon([
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])
        let sjsh0 = "0x" + Array.from(jsh0).map(byte => byte.toString(16).padStart(2, '0')).join('')

        const jsh1 = jsPosiedon([
            "0x0000000000000000000000003C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])
        let sjsh1 = "0x" + Array.from(jsh1).map(byte => byte.toString(16).padStart(2, '0')).join('')

        const jsregularRoot = jsPosiedon([jsh1, jsh0]);
        let sjsregularRoot = "0x" + Array.from(jsregularRoot).map(byte => byte.toString(16).padStart(2, '0')).join('')

        const jsreverseRoot = jsPosiedon([jsregularRoot, zero]);
        let sjsreverseRoot = "0x" + Array.from(jsreverseRoot).map(byte => byte.toString(16).padStart(2, '0')).join('')

        console.log("Off-Chain values:")
        console.log(`h0                  = ${sjsh0}`)
        console.log(`h1                  = ${sjsh1}`)
        console.log(`Hash(h1,h0)         = ${sjsregularRoot}`)
        console.log(`Hash(Hash(h1,h0),0) = ${sjsreverseRoot}`)
        console.log()

        expect(sRoot).to.equal(sjsreverseRoot)
    });

    it("Should add two leaves (test2).", async function () {
        const { tree, hash2, hash3 } = await loadFixture(deployTreeTest);

        // Address = 1111...0110
        await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n * 10n ** 18n)
        // Address = 0001...0101
        await tree.recordBalance('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', 5n * 10n ** 18n)

        const nRoot = await tree.getRoot()
        const sRoot = await contract_to_js_hash(nRoot)
        const root = BigInt2Hex(nRoot)

        console.log(`Tree Root (original):  ${root}`);
        console.log(`Tree Root (corrected): ${sRoot}`);
        console.log()

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

        // Compute off-chain hashes
        let jsPosiedon = await buildPoseidon()
        let jsh0 = jsPosiedon([
            "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])

        const jsh1 = jsPosiedon([
            "0x00000000000000000000000015d34AAf54267DB7D7c367839AAf71A00a2C6A65",
            "0x0000000000000000000000000000000000000000000000004563918244f40000",
            "0x0000000000000000000000000000000000000000000000000000000000000001"])

        const jsreverseRoot = jsPosiedon([jsh0, jsh1]);
        let sjsreverseRoot = "0x" + Array.from(jsreverseRoot).map(byte => byte.toString(16).padStart(2, '0')).join('')

        expect(sRoot).to.equal(sjsreverseRoot)
    });

    it("Should add ten leaves.", async function () {
        const { tree } = await loadFixture(deployTreeTest);

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

        const nRoot = await tree.getRoot()
        const sRoot = await contract_to_js_hash(nRoot)
        const root = BigInt2Hex(nRoot)

        console.log(`Tree Root (original):  ${root}`);
        console.log(`Tree Root (corrected): ${sRoot}`);
        console.log()

        const expectedRoot = "0xa76bb982d93458eb58f4fe61ba96054d68c4edb51ea118370a3035f387857628";

        console.log(`Expected: ${expectedRoot}`)
        console.log(`Actual:   ${sRoot}`)

        // Confirm root match
        expect(sRoot).to.equal(expectedRoot)
    });
});
