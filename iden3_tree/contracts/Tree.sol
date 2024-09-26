// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SmtLib.sol";
using SmtLib for SmtLib.Data;

contract TokenSnapshot {
    SmtLib.Data smt;

    constructor(uint256 level) {
        // Ethereum addresses are 20-byte (160-bit) long.
        // The SMT leaf address (index) will identify an
        // ethereum address, the value will store the token
        // balance.
        smt.initialize(level);
    }

    function getMaxDepth() public view returns (uint256) {
        return smt.getMaxDepth();
    }

    function getRoot() public view returns (uint256) {
        return smt.getRoot();
    }

    function recordBalance(address addr, uint256 balance) external {
        smt.addLeaf(uint256(uint160(addr)), balance);
    }

    function pom(address addr) public view returns (SmtLib.Proof memory) {
        return smt.getProof(uint256(uint160(addr)));
    }

    // Helpers to produce keccak256 hashes
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
