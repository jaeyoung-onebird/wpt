// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title WorkLogRegistry
 * @dev 근무 로그를 블록체인에 기록하는 레지스트리
 */
contract WorkLogRegistry {

    // 근무 로그 구조체
    struct WorkLog {
        bytes32 logHash;           // 근무 로그 해시
        uint256 eventId;           // 행사 ID
        bytes32 workerUidHash;     // 근무자 UID 해시 (개인정보 보호)
        address anchoredBy;        // 기록한 주소
        uint256 timestamp;         // 기록 시간
    }

    // 로그 해시 => WorkLog 매핑
    mapping(bytes32 => WorkLog) public workLogs;

    // 이벤트
    event WorkLogRecorded(
        bytes32 indexed logHash,
        uint256 indexed eventId,
        bytes32 indexed workerUidHash,
        address anchoredBy,
        uint256 timestamp
    );

    /**
     * @dev 근무 로그 기록
     * @param logHash 근무 로그 해시
     * @param eventId 행사 ID
     * @param workerUidHash 근무자 UID 해시
     */
    function recordWorkLog(
        bytes32 logHash,
        uint256 eventId,
        bytes32 workerUidHash
    ) external {
        require(logHash != bytes32(0), "Invalid log hash");
        require(eventId > 0, "Invalid event ID");
        require(workerUidHash != bytes32(0), "Invalid worker UID hash");
        require(workLogs[logHash].timestamp == 0, "Log already exists");

        workLogs[logHash] = WorkLog({
            logHash: logHash,
            eventId: eventId,
            workerUidHash: workerUidHash,
            anchoredBy: msg.sender,
            timestamp: block.timestamp
        });

        emit WorkLogRecorded(
            logHash,
            eventId,
            workerUidHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev 로그 해시로 근무 로그 조회
     * @param logHash 근무 로그 해시
     * @return WorkLog 구조체
     */
    function getWorkLog(bytes32 logHash) external view returns (WorkLog memory) {
        return workLogs[logHash];
    }

    /**
     * @dev 로그 존재 여부 확인
     * @param logHash 근무 로그 해시
     * @return bool 존재 여부
     */
    function logExists(bytes32 logHash) external view returns (bool) {
        return workLogs[logHash].timestamp != 0;
    }
}
