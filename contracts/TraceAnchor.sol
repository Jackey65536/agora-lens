// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TraceAnchor {
    uint256 public constant MAX_URI_LENGTH = 2048;

    struct Anchor {
        address publisher;
        bytes32 signalId;
        string uri;
        uint64 anchoredAt;
    }

    error ZeroTraceHash();
    error ZeroSignalId();
    error EmptyUri();
    error UriTooLong(uint256 length);
    error TraceAlreadyAnchored(bytes32 traceHash);

    event TraceAnchored(
        bytes32 indexed traceHash,
        bytes32 indexed signalId,
        address indexed publisher,
        string uri,
        uint64 anchoredAt
    );

    mapping(bytes32 traceHash => Anchor anchor) private anchors;

    function anchorTrace(bytes32 traceHash, bytes32 signalId, string calldata uri) external returns (uint64 anchoredAt) {
        if (traceHash == bytes32(0)) revert ZeroTraceHash();
        if (signalId == bytes32(0)) revert ZeroSignalId();
        uint256 uriLength = bytes(uri).length;
        if (uriLength == 0) revert EmptyUri();
        if (uriLength > MAX_URI_LENGTH) revert UriTooLong(uriLength);
        if (anchors[traceHash].publisher != address(0)) revert TraceAlreadyAnchored(traceHash);

        anchoredAt = uint64(block.timestamp);
        anchors[traceHash] = Anchor({
            publisher: msg.sender,
            signalId: signalId,
            uri: uri,
            anchoredAt: anchoredAt
        });

        emit TraceAnchored(traceHash, signalId, msg.sender, uri, anchoredAt);
    }

    function getAnchor(bytes32 traceHash)
        external
        view
        returns (address publisher, bytes32 signalId, string memory uri, uint64 anchoredAt)
    {
        Anchor storage anchor = anchors[traceHash];
        return (anchor.publisher, anchor.signalId, anchor.uri, anchor.anchoredAt);
    }

    function isAnchored(bytes32 traceHash) external view returns (bool) {
        return anchors[traceHash].publisher != address(0);
    }
}
