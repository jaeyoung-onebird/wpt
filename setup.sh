#!/bin/bash

# WorkProof Chain 초기 설정 스크립트

echo "⛓️ WorkProof Chain 초기 설정 시작..."

# 1. 디렉토리 생성
echo "📁 디렉토리 생성 중..."
mkdir -p data/exports logs contracts/compiled

# 2. Python 가상환경
if [ ! -d "venv" ]; then
    echo "🐍 Python 가상환경 생성 중..."
    python3 -m venv venv
fi

echo "🐍 가상환경 활성화..."
source venv/bin/activate

# 3. 의존성 설치
echo "📦 의존성 설치 중..."
pip install --upgrade pip
pip install -r requirements.txt

# 4. 환경변수 파일 생성
if [ ! -f "config/.env" ]; then
    echo "⚙️ 환경변수 파일 생성 중..."
    cp config/.env.example config/.env
    echo "✅ config/.env 파일이 생성되었습니다."
    echo "⚠️  config/.env 파일을 열어 실제 값으로 수정하세요!"
else
    echo "ℹ️  config/.env 파일이 이미 존재합니다."
fi

# 5. DB 초기화
echo "💾 데이터베이스 초기화 중..."
python3 << EOF
from src.db import Database
import os

db_path = os.getenv('DB_PATH', 'data/workproof.db')
db = Database(db_path)
print('✅ 데이터베이스 초기화 완료!')
EOF

# 6. 관리자 등록 (선택)
echo ""
echo "👤 관리자를 등록하시겠습니까? (y/n)"
read -r answer

if [ "$answer" = "y" ]; then
    echo "텔레그램 ID를 입력하세요:"
    read -r telegram_id
    echo "유저네임을 입력하세요 (선택, 없으면 Enter):"
    read -r username

    python3 << EOF
from src.db import Database
import os

db_path = os.getenv('DB_PATH', 'data/workproof.db')
db = Database(db_path)

telegram_id = $telegram_id
username = "$username" if "$username" else None

db.add_admin(telegram_id, username)
print(f'✅ 관리자 등록 완료! (ID: {telegram_id})')
EOF
fi

# 7. 권한 설정
echo "🔒 파일 권한 설정 중..."
chmod 600 config/.env
chmod +x bot-control.sh

# 완료
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 초기 설정이 완료되었습니다!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "다음 단계:"
echo "1. config/.env 파일을 열어 실제 값으로 수정"
echo "2. 봇 실행: python3 src/admin_bot.py"
echo "3. 또는 systemd 서비스로 실행:"
echo "   sudo cp systemd/*.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable --now workproof-admin.service workproof-worker.service"
echo ""
echo "⛓️ WorkProof Chain by LK"
