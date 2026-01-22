# WorkProof Chain 운영 가이드

## 📦 배포 (Ubuntu 서버)

### 1. 초기 설정

```bash
# 1. 프로젝트 클론 또는 업로드
cd /home/ubuntu
git clone <repository> workproof-chain-v2
cd workproof-chain-v2

# 2. Python 가상환경 생성
python3 -m venv venv
source venv/bin/activate

# 3. 의존성 설치
pip install -r requirements.txt

# 4. 환경변수 설정
cp config/.env.example config/.env
nano config/.env  # 실제 값으로 수정

# 5. 디렉토리 생성
mkdir -p data/exports logs

# 6. DB 초기화 (자동으로 생성됨)
python3 -c "from src.db import Database; db = Database('data/workproof.db'); print('DB initialized')"

# 7. 관리자 등록
python3 << EOF
from src.db import Database
db = Database('data/workproof.db')
db.add_admin(YOUR_TELEGRAM_ID, 'your_username')
print('Admin added')
EOF
```

### 2. Systemd 서비스 등록

```bash
# 서비스 파일 복사
sudo cp systemd/workproof-admin.service /etc/systemd/system/
sudo cp systemd/workproof-worker.service /etc/systemd/system/

# 권한 설정
sudo chmod 644 /etc/systemd/system/workproof-*.service

# Systemd 리로드
sudo systemctl daemon-reload

# 서비스 활성화 및 시작
sudo systemctl enable workproof-admin.service
sudo systemctl enable workproof-worker.service

sudo systemctl start workproof-admin.service
sudo systemctl start workproof-worker.service

# 상태 확인
sudo systemctl status workproof-admin.service
sudo systemctl status workproof-worker.service
```

### 3. 로그 확인

```bash
# 실시간 로그 확인
tail -f logs/admin_bot.log
tail -f logs/worker_bot.log

# Systemd 로그
sudo journalctl -u workproof-admin.service -f
sudo journalctl -u workproof-worker.service -f
```

---

## 🔧 일상 운영

### 봇 재시작

```bash
sudo systemctl restart workproof-admin.service
sudo systemctl restart workproof-worker.service
```

### 봇 중지

```bash
sudo systemctl stop workproof-admin.service
sudo systemctl stop workproof-worker.service
```

### 로그 로테이션

```bash
# /etc/logrotate.d/workproof 생성
sudo nano /etc/logrotate.d/workproof

# 내용:
/home/ubuntu/workproof-chain-v2/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 ubuntu ubuntu
    sharedscripts
    postrotate
        systemctl reload workproof-admin.service > /dev/null 2>&1 || true
        systemctl reload workproof-worker.service > /dev/null 2>&1 || true
    endscript
}
```

---

## 💾 백업

### DB 백업

```bash
# 수동 백업
sqlite3 data/workproof.db ".backup 'data/backup_$(date +%Y%m%d_%H%M%S).db'"

# 자동 백업 (cron)
# crontab -e
0 3 * * * cd /home/ubuntu/workproof-chain-v2 && sqlite3 data/workproof.db ".backup 'data/backup_$(date +\%Y\%m\%d).db'" && find data/backup_*.db -mtime +30 -delete
```

### 전체 백업

```bash
tar -czf workproof_backup_$(date +%Y%m%d).tar.gz \
    data/ logs/ config/.env
```

---

## 🚨 장애 대응

### 1. 봇이 응답하지 않을 때

```bash
# 상태 확인
sudo systemctl status workproof-admin.service
sudo systemctl status workproof-worker.service

# 로그 확인
tail -100 logs/admin_bot.log
tail -100 logs/worker_bot.log

# 재시작
sudo systemctl restart workproof-admin.service
sudo systemctl restart workproof-worker.service
```

### 2. DB 손상 시

```bash
# 무결성 검사
sqlite3 data/workproof.db "PRAGMA integrity_check;"

# 백업에서 복구
cp data/backup_YYYYMMDD.db data/workproof.db
sudo systemctl restart workproof-admin.service workproof-worker.service
```

### 3. 블록체인 연결 실패

```bash
# .env 확인
cat config/.env | grep POLYGON

# RPC 연결 테스트
python3 << EOF
from src.chain import polygon_chain
print(f"Connected: {polygon_chain.is_connected()}")
print(f"Balance: {polygon_chain.get_balance()} MATIC")
EOF
```

### 4. 메모리 부족

```bash
# 메모리 확인
free -h

# 봇 재시작 (메모리 정리)
sudo systemctl restart workproof-admin.service workproof-worker.service

# 스왑 추가 (필요시)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📊 모니터링

### 핵심 지표

1. **봇 상태**: `systemctl status workproof-*`
2. **로그 에러**: `grep ERROR logs/*.log`
3. **DB 크기**: `du -h data/workproof.db`
4. **블록체인 잔액**: `.env`에서 계정 주소 확인 후 PolygonScan 조회

### 알림 설정 (선택)

```bash
# 봇 다운 시 이메일 알림 (systemd)
sudo nano /etc/systemd/system/workproof-admin.service

# [Service] 섹션에 추가:
# OnFailure=status-email@%n.service
```

---

## 🔐 보안

### 1. .env 파일 보호

```bash
chmod 600 config/.env
```

### 2. DB 백업 암호화

```bash
# 백업 시 암호화
tar -czf - data/ | openssl enc -aes-256-cbc -e > backup_encrypted.tar.gz.enc

# 복원 시 복호화
openssl enc -aes-256-cbc -d -in backup_encrypted.tar.gz.enc | tar xzf -
```

### 3. 방화벽 설정

```bash
# UFW 활성화 (SSH만 허용)
sudo ufw allow ssh
sudo ufw enable
```

---

## 📈 확장

### 메인넷 전환

1. `.env` 수정:
   ```
   POLYGON_NETWORK=polygon
   POLYGON_RPC_URL=https://polygon-rpc.com
   CONTRACT_ADDRESS=<mainnet_contract_address>
   CHAIN_ID=137
   ```

2. 컨트랙트 재배포 (Remix 또는 Hardhat 사용)

3. 충분한 MATIC 확보

4. 봇 재시작

### 다중 서버 배포

- Load Balancer 앞단 배치
- DB를 PostgreSQL로 마이그레이션
- Redis로 세션 공유

---

## 🧪 테스트

### 1. 로컬 테스트

```bash
# Admin 봇 실행
python3 src/admin_bot.py

# Worker 봇 실행 (별도 터미널)
python3 src/worker_bot.py
```

### 2. 기능 테스트 체크리스트

- [ ] 행사 등록 (파싱 테스트)
- [ ] 모집글 Deep Link 생성
- [ ] 근무자 최초 등록
- [ ] 지원하기
- [ ] 관리자 확정
- [ ] 출석 코드 생성
- [ ] 출석/퇴근 처리
- [ ] 블록체인 기록
- [ ] 엑셀 다운로드

---

## 📞 문의

문제 발생 시:
1. 로그 확인 (`logs/*.log`)
2. GitHub Issues 등록
3. 담당자 연락

⛓️ WorkProof Chain by LK
