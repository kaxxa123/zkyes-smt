// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@solarity/solidity-lib/libs/data-structures/SparseMerkleTree.sol";
using SparseMerkleTree for SparseMerkleTree.UintSMT;

contract TokenSnapshot {
    SparseMerkleTree.UintSMT smt;

    constructor() {
        // Ethereum addresses are 20-byte (160-bit) long.
        // The SMT leaf address (index) will identify an
        // ethereum address, the value will store the token
        // balance.
        smt.initialize(160);
    }

    function recordBalance(address addr, uint256 balance) external {
        uint256 smtKey = uint256(uint160(addr));
        SparseMerkleTree.Node memory node = smt.getNodeByKey(smtKey);

        // All good zero balance is already recorded
        if (
            (node.nodeType == SparseMerkleTree.NodeType.EMPTY) && (balance == 0)
        ) return;
        else if (balance == 0) smt.remove(bytes32(smtKey));
        else if (balance != 0)
            smt.update(bytes32(uint256(uint160(addr))), balance);
        else smt.add(bytes32(uint256(uint160(addr))), balance);
    }

    function getLeafValue(address addr) public view returns (uint256) {
        uint256 smtKey = uint256(uint160(addr));
        SparseMerkleTree.Node memory node = smt.getNodeByKey(smtKey);

        return
            (node.nodeType == SparseMerkleTree.NodeType.EMPTY)
                ? 0
                : uint256(node.value);
    }

    function pom(
        address addr
    ) public view returns (SparseMerkleTree.Proof memory) {
        uint256 smtKey = uint256(uint160(addr));

        return smt.getProof(bytes32(smtKey));
    }

    function hash3(
        bytes32 a,
        bytes32 b,
        bytes32 c
    ) public pure returns (bytes32 result) {
        assembly {
            let free_ptr := mload(64)

            mstore(free_ptr, a)
            mstore(add(free_ptr, 32), b)
            mstore(add(free_ptr, 64), c)

            result := keccak256(free_ptr, 96)
        }
    }

    function hash2(bytes32 a, bytes32 b) public pure returns (bytes32 result) {
        assembly {
            mstore(0, a)
            mstore(32, b)

            result := keccak256(0, 64)
        }
    }
}
