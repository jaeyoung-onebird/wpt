// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title WorkProofToken (WPT)
 * @dev 근무증명 플랫폼용 크레딧 토큰
 *
 * 특징:
 * - 전송 제한: 오직 플랫폼(owner)만 전송 가능
 * - Mint: 플랫폼이 사용자에게 토큰 발행
 * - Burn: 증명서 발급 시 토큰 소각
 * - 업그레이드 가능: UUPS Proxy 패턴
 */
contract WorkProofToken is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // 전송 허용 여부 (나중에 true로 변경 가능)
    bool public transfersEnabled;

    // 화이트리스트 (전송 가능한 주소)
    mapping(address => bool) public transferWhitelist;

    // 이벤트
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);
    event TransfersToggled(bool enabled);
    event WhitelistUpdated(address indexed account, bool status);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 초기화 함수 (생성자 대신 사용)
     */
    function initialize() public initializer {
        __ERC20_init("WorkProof Token", "WPT");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        transfersEnabled = false;  // 초기에는 전송 비활성화
        transferWhitelist[msg.sender] = true;  // owner는 항상 전송 가능
    }

    /**
     * @dev 토큰 발행 (플랫폼 전용)
     * @param to 받을 주소
     * @param amount 발행량
     * @param reason 발행 사유
     */
    function mint(address to, uint256 amount, string calldata reason) external onlyOwner {
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }

    /**
     * @dev 토큰 소각 (증명서 발급 시)
     * @param from 소각할 주소
     * @param amount 소각량
     * @param reason 소각 사유
     */
    function burn(address from, uint256 amount, string calldata reason) external onlyOwner {
        _burn(from, amount);
        emit TokensBurned(from, amount, reason);
    }

    /**
     * @dev 전송 기능 활성화/비활성화
     */
    function toggleTransfers(bool enabled) external onlyOwner {
        transfersEnabled = enabled;
        emit TransfersToggled(enabled);
    }

    /**
     * @dev 화이트리스트 관리
     */
    function setWhitelist(address account, bool status) external onlyOwner {
        transferWhitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }

    /**
     * @dev 배치 발행 (여러 주소에 한번에)
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata reason
    ) external onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            emit TokensMinted(recipients[i], amounts[i], reason);
        }
    }

    /**
     * @dev 전송 전 체크 (오버라이드)
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        // mint(from=0) 또는 burn(to=0)은 항상 허용
        if (from != address(0) && to != address(0)) {
            // 일반 전송인 경우
            require(
                transfersEnabled ||
                transferWhitelist[from] ||
                transferWhitelist[to],
                "Transfers disabled"
            );
        }
        super._update(from, to, value);
    }

    /**
     * @dev 업그레이드 권한 체크
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev 소수점 자릿수 (0 = 정수 단위)
     */
    function decimals() public pure override returns (uint8) {
        return 0;
    }
}
