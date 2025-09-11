// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title ConfidentialStrings
/// @notice Stores strings by id. On Sapphire, contract state and calldata are encrypted at rest/in-flight;
///         avoid logging sensitive data in events (we only emit the id).
contract ConfidentialStrings {
    mapping(uint256 => string) private _data;

    /// @dev Emitting the id only (not the string) helps avoid leaking sensitive data via logs.
    event Stored(uint256 indexed id);

    /// @notice Store a string under an id.
    /// @param id The identifier to store under.
    /// @param value The string to store (e.g., "{42, hello world}").
    function store(uint256 id, string calldata value) external {
        require(bytes(value).length != 0, "empty value");
        _data[id] = value;
        emit Stored(id);
    }

    /// @notice Get the string stored for an id.
    /// @param id The identifier to query.
    /// @return value The stored string (empty if none set).
    function get(uint256 id) external view returns (string memory value) {
        return _data[id];
    }
}