// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract TokenDrop {
    error ErrAlreadyClaimed();
    error InvalidProof();
    error TransferFailed();

    address public immutable token;
    bytes32 public immutable merkleRoot;

    mapping(address => bool) public isClaimed;

    constructor(address token_, bytes32 merkleRoot_) {
        token = token_;
        merkleRoot = merkleRoot_;
    }

    function preimage(
        address account,
        uint256 amount
    ) public pure returns (bytes memory) {
        return abi.encode(account, amount);
    }

    function hash(bytes calldata data) public pure returns (bytes32) {
        return keccak256(data);
    }

    function hashpair(
        address account,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(preimage(account, amount));
    }

    function claim(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        // Hardhat doesn't yet support Errors with require.
        // If a clause fails we won't be shown the error info.
        // So we have to drop their use for this test project...
        require(!isClaimed[account], "ErrAlreadyClaimed()");

        // Encode value as two 32-byte values...
        bytes32 node = hashpair(account, amount);
        bool isValidProof = MerkleProof.verifyCalldata(
            merkleProof,
            merkleRoot,
            node
        );
        require(isValidProof, "InvalidProof()");

        isClaimed[account] = true;
        require(IERC20(token).transfer(account, amount), "TransferFailed()");
    }
}
