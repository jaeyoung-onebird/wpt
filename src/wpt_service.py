"""
WorkProof Token (WPT) 서비스
- 커스토디얼 지갑 관리
- 토큰 발행/소각
- 크레딧 시스템 통합
"""
import os
import logging
from typing import Dict, Optional
from web3 import Web3
from web3.middleware import geth_poa_middleware
import json
from eth_account import Account

logger = logging.getLogger(__name__)


# WPT 토큰 ABI (필요한 함수만)
WPT_ABI = [
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
            {"name": "reason", "type": "string"}
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "from", "type": "address"},
            {"name": "amount", "type": "uint256"},
            {"name": "reason", "type": "string"}
        ],
        "name": "burn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "transfersEnabled",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "amount", "type": "uint256"},
            {"indexed": False, "name": "reason", "type": "string"}
        ],
        "name": "TokensMinted",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": False, "name": "amount", "type": "uint256"},
            {"indexed": False, "name": "reason", "type": "string"}
        ],
        "name": "TokensBurned",
        "type": "event"
    }
]


class WPTService:
    """WorkProof Token 서비스 클래스"""

    def __init__(self):
        self.rpc_url = os.getenv('POLYGON_RPC_URL')
        self.private_key = os.getenv('POLYGON_PRIVATE_KEY')
        self.wpt_contract_address = os.getenv('WPT_CONTRACT_ADDRESS')
        self.chain_id = int(os.getenv('CHAIN_ID', 80002))
        self.network = os.getenv('POLYGON_NETWORK', 'amoy')

        if not all([self.rpc_url, self.private_key, self.wpt_contract_address]):
            logger.warning("WPT configuration incomplete. Token features disabled.")
            self.enabled = False
            return

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)

        self.account = self.w3.eth.account.from_key(self.private_key)
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.wpt_contract_address),
            abi=WPT_ABI
        )
        self.enabled = True

        logger.info(f"WPT Service initialized: contract={self.wpt_contract_address}, admin={self.account.address}")

    def generate_wallet_address(self) -> Dict:
        """
        새 지갑 주소 생성 (커스토디얼)
        실제 프라이빗 키는 저장하지 않고, worker_id 기반 결정론적 주소 사용

        Returns:
            dict: {"address": str}
        """
        # 간단한 방식: 랜덤 계정 생성 (프라이빗키는 플랫폼이 관리하므로 저장 불필요)
        new_account = Account.create()
        return {"address": new_account.address}

    def get_deterministic_address(self, worker_id: int) -> str:
        """
        Worker ID 기반 결정론적 주소 생성
        모든 토큰은 플랫폼 계정에서 직접 관리하므로 실제로는 사용하지 않음

        Args:
            worker_id: 근무자 ID

        Returns:
            str: 지갑 주소
        """
        # 플랫폼 주소 + worker_id로 해시 생성
        seed = f"workproof_wallet_{worker_id}_{os.getenv('SALT_SECRET', 'default')}"
        seed_bytes = seed.encode('utf-8')
        # keccak256 해시의 마지막 20바이트를 주소로 사용
        hash_bytes = Web3.keccak(seed_bytes)
        address = Web3.to_checksum_address(hash_bytes[-20:].hex())
        return address

    def mint_credits(self, worker_address: str, amount: int, reason: str) -> Dict:
        """
        크레딧(WPT) 발행

        Args:
            worker_address: 근무자 지갑 주소
            amount: 발행량 (정수, 1 = 1 크레딧)
            reason: 발행 사유

        Returns:
            dict: {"success": bool, "tx_hash": str, "error": str}
        """
        if not self.enabled:
            return {"success": False, "error": "WPT service not configured"}

        try:
            nonce = self.w3.eth.get_transaction_count(self.account.address)

            tx = self.contract.functions.mint(
                Web3.to_checksum_address(worker_address),
                amount,
                reason
            ).build_transaction({
                'chainId': self.chain_id,
                'gas': 150000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })

            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt['status'] == 1:
                logger.info(f"Minted {amount} WPT to {worker_address}: tx={tx_hash.hex()}")
                return {
                    "success": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": receipt['blockNumber'],
                    "gas_used": receipt['gasUsed']
                }
            else:
                return {"success": False, "error": "Transaction reverted", "tx_hash": tx_hash.hex()}

        except Exception as e:
            logger.error(f"Failed to mint WPT: {e}")
            return {"success": False, "error": str(e)}

    def burn_credits(self, worker_address: str, amount: int, reason: str) -> Dict:
        """
        크레딧(WPT) 소각

        Args:
            worker_address: 근무자 지갑 주소
            amount: 소각량 (정수, 1 = 1 크레딧)
            reason: 소각 사유

        Returns:
            dict: {"success": bool, "tx_hash": str, "error": str}
        """
        if not self.enabled:
            return {"success": False, "error": "WPT service not configured"}

        try:
            nonce = self.w3.eth.get_transaction_count(self.account.address)

            tx = self.contract.functions.burn(
                Web3.to_checksum_address(worker_address),
                amount,
                reason
            ).build_transaction({
                'chainId': self.chain_id,
                'gas': 150000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })

            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt['status'] == 1:
                logger.info(f"Burned {amount} WPT from {worker_address}: tx={tx_hash.hex()}")
                return {
                    "success": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": receipt['blockNumber'],
                    "gas_used": receipt['gasUsed']
                }
            else:
                return {"success": False, "error": "Transaction reverted", "tx_hash": tx_hash.hex()}

        except Exception as e:
            logger.error(f"Failed to burn WPT: {e}")
            return {"success": False, "error": str(e)}

    def get_balance(self, address: str) -> int:
        """
        크레딧 잔액 조회

        Args:
            address: 지갑 주소

        Returns:
            int: 크레딧 잔액
        """
        if not self.enabled:
            return 0

        try:
            balance = self.contract.functions.balanceOf(
                Web3.to_checksum_address(address)
            ).call()
            return balance
        except Exception as e:
            logger.error(f"Failed to get WPT balance: {e}")
            return 0

    def get_total_supply(self) -> int:
        """전체 발행량 조회"""
        if not self.enabled:
            return 0

        try:
            return self.contract.functions.totalSupply().call()
        except Exception as e:
            logger.error(f"Failed to get total supply: {e}")
            return 0

    def get_token_info(self) -> Dict:
        """토큰 정보 조회"""
        if not self.enabled:
            return {"enabled": False}

        try:
            return {
                "enabled": True,
                "name": self.contract.functions.name().call(),
                "symbol": self.contract.functions.symbol().call(),
                "total_supply": self.contract.functions.totalSupply().call(),
                "transfers_enabled": self.contract.functions.transfersEnabled().call(),
                "contract_address": self.wpt_contract_address,
                "network": self.network
            }
        except Exception as e:
            logger.error(f"Failed to get token info: {e}")
            return {"enabled": False, "error": str(e)}

    def get_explorer_url(self, tx_hash: str) -> str:
        """블록 탐색기 URL 생성"""
        if self.network == 'polygon':
            return f"https://polygonscan.com/tx/{tx_hash}"
        else:  # amoy testnet
            return f"https://amoy.polygonscan.com/tx/{tx_hash}"

    def get_token_explorer_url(self, address: str) -> str:
        """토큰 홀더 페이지 URL 생성"""
        if self.network == 'polygon':
            return f"https://polygonscan.com/token/{self.wpt_contract_address}?a={address}"
        else:
            return f"https://amoy.polygonscan.com/token/{self.wpt_contract_address}?a={address}"


# 싱글톤 인스턴스
wpt_service = WPTService()
