"""
Polygon 블록체인 연동 모듈
"""
import os
import logging
from typing import Dict, Optional
from web3 import Web3
from web3.middleware import geth_poa_middleware
import json

logger = logging.getLogger(__name__)


class PolygonChain:
    """Polygon 블록체인 연동 클래스"""

    def __init__(self):
        self.rpc_url = os.getenv('POLYGON_RPC_URL')
        self.private_key = os.getenv('POLYGON_PRIVATE_KEY')
        self.contract_address = os.getenv('CONTRACT_ADDRESS')
        self.chain_id = int(os.getenv('CHAIN_ID', 80002))
        self.network = os.getenv('POLYGON_NETWORK', 'amoy')

        if not all([self.rpc_url, self.private_key, self.contract_address]):
            logger.warning("Polygon configuration incomplete. Blockchain features disabled.")
            self.enabled = False
            return

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)

        self.account = self.w3.eth.account.from_key(self.private_key)
        self.contract = self._load_contract()
        self.enabled = True

        logger.info(f"Polygon chain initialized: network={self.network}, account={self.account.address}")

    def _load_contract(self):
        """스마트 컨트랙트 로드"""
        # ABI 파일 경로
        abi_path = os.path.join(os.path.dirname(__file__), '../contracts/compiled/WorkLogRegistry.json')

        try:
            with open(abi_path, 'r') as f:
                contract_data = json.load(f)
                abi = contract_data.get('abi', [])

            return self.w3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=abi
            )
        except FileNotFoundError:
            logger.warning(f"Contract ABI not found at {abi_path}. Using minimal ABI.")
            # 최소 ABI (recordWorkLog 함수만)
            minimal_abi = [{
                "inputs": [
                    {"name": "logHash", "type": "bytes32"},
                    {"name": "eventId", "type": "uint256"},
                    {"name": "workerUidHash", "type": "bytes32"}
                ],
                "name": "recordWorkLog",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }]
            return self.w3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=minimal_abi
            )

    def record_work_log(self, log_hash: str, event_id: int, worker_uid_hash: str) -> Dict:
        """
        근무 로그를 블록체인에 기록

        Args:
            log_hash: 근무 로그 해시 (hex string)
            event_id: 행사 ID
            worker_uid_hash: 근무자 UID 해시 (hex string)

        Returns:
            dict: {"success": bool, "tx_hash": str, "block_number": int, "error": str}
        """
        if not self.enabled:
            return {"success": False, "error": "Blockchain not configured"}

        try:
            # Hex string을 bytes32로 변환
            log_hash_bytes = bytes.fromhex(log_hash.replace('0x', ''))
            worker_uid_bytes = bytes.fromhex(worker_uid_hash.replace('0x', ''))

            # 트랜잭션 생성
            nonce = self.w3.eth.get_transaction_count(self.account.address)

            tx = self.contract.functions.recordWorkLog(
                log_hash_bytes,
                event_id,
                worker_uid_bytes
            ).build_transaction({
                'chainId': self.chain_id,
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })

            # 서명 및 전송
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)

            # 트랜잭션 영수증 대기
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt['status'] == 1:
                logger.info(f"Work log recorded on chain: tx={tx_hash.hex()}, block={receipt['blockNumber']}")
                return {
                    "success": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": receipt['blockNumber'],
                    "gas_used": receipt['gasUsed']
                }
            else:
                logger.error(f"Transaction failed: {tx_hash.hex()}")
                return {
                    "success": False,
                    "error": "Transaction reverted",
                    "tx_hash": tx_hash.hex()
                }

        except Exception as e:
            logger.error(f"Failed to record on blockchain: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_block_explorer_url(self, tx_hash: str) -> str:
        """
        블록 탐색기 URL 생성

        Args:
            tx_hash: 트랜잭션 해시

        Returns:
            str: PolygonScan URL
        """
        if self.network == 'polygon':
            return f"https://polygonscan.com/tx/{tx_hash}"
        else:  # amoy testnet
            return f"https://amoy.polygonscan.com/tx/{tx_hash}"

    def get_balance(self) -> float:
        """
        계정 잔액 조회 (MATIC)

        Returns:
            float: 잔액 (MATIC)
        """
        if not self.enabled:
            return 0.0

        balance_wei = self.w3.eth.get_balance(self.account.address)
        return self.w3.from_wei(balance_wei, 'ether')

    def is_connected(self) -> bool:
        """
        RPC 연결 확인

        Returns:
            bool: 연결 여부
        """
        if not self.enabled:
            return False

        try:
            return self.w3.is_connected()
        except Exception:
            return False


# 싱글톤 인스턴스
polygon_chain = PolygonChain()
