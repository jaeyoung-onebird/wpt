#!/bin/bash

# WorkProof Chain Bot Control Script

case "$1" in
    start)
        echo "🚀 WorkProof Chain 봇 시작 중..."
        sudo systemctl start workproof-admin.service
        sudo systemctl start workproof-worker.service
        echo "✅ 봇이 시작되었습니다."
        ;;
    stop)
        echo "🛑 WorkProof Chain 봇 중지 중..."
        sudo systemctl stop workproof-admin.service
        sudo systemctl stop workproof-worker.service
        echo "✅ 봇이 중지되었습니다."
        ;;
    restart)
        echo "🔄 WorkProof Chain 봇 재시작 중..."
        sudo systemctl restart workproof-admin.service
        sudo systemctl restart workproof-worker.service
        echo "✅ 봇이 재시작되었습니다."
        ;;
    status)
        echo "⛓️ WorkProof Chain 봇 상태"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        sudo systemctl status workproof-admin.service --no-pager
        echo ""
        sudo systemctl status workproof-worker.service --no-pager
        ;;
    logs)
        if [ "$2" == "admin" ]; then
            echo "📋 Admin Bot 로그 (최근 50줄):"
            tail -50 logs/admin_bot.log
        elif [ "$2" == "worker" ]; then
            echo "📋 Worker Bot 로그 (최근 50줄):"
            tail -50 logs/worker_bot.log
        else
            echo "📋 Admin Bot 로그 (최근 20줄):"
            tail -20 logs/admin_bot.log
            echo ""
            echo "📋 Worker Bot 로그 (최근 20줄):"
            tail -20 logs/worker_bot.log
        fi
        ;;
    follow)
        if [ "$2" == "admin" ]; then
            echo "📋 Admin Bot 로그 실시간 (Ctrl+C로 종료):"
            tail -f logs/admin_bot.log
        elif [ "$2" == "worker" ]; then
            echo "📋 Worker Bot 로그 실시간 (Ctrl+C로 종료):"
            tail -f logs/worker_bot.log
        else
            echo "Usage: $0 follow [admin|worker]"
            exit 1
        fi
        ;;
    install)
        echo "📦 Systemd 서비스 설치 중..."
        sudo cp systemd/workproof-admin.service /etc/systemd/system/
        sudo cp systemd/workproof-worker.service /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable workproof-admin.service
        sudo systemctl enable workproof-worker.service
        echo "✅ Systemd 서비스가 설치되었습니다."
        echo "이제 './bot-control.sh start'로 봇을 시작할 수 있습니다."
        ;;
    test)
        echo "🧪 로컬 테스트 모드로 봇 실행..."
        source venv/bin/activate

        if [ "$2" == "admin" ]; then
            echo "Admin Bot 실행 중..."
            python3 src/admin_bot.py
        elif [ "$2" == "worker" ]; then
            echo "Worker Bot 실행 중..."
            python3 src/worker_bot.py
        else
            echo "Usage: $0 test [admin|worker]"
            exit 1
        fi
        ;;
    *)
        echo "⛓️ WorkProof Chain Bot Control"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Usage: $0 {start|stop|restart|status|logs|follow|install|test}"
        echo ""
        echo "Commands:"
        echo "  start          - 봇 시작"
        echo "  stop           - 봇 중지"
        echo "  restart        - 봇 재시작"
        echo "  status         - 봇 상태 확인"
        echo "  logs [admin|worker] - 로그 확인"
        echo "  follow [admin|worker] - 로그 실시간 확인"
        echo "  install        - Systemd 서비스 설치"
        echo "  test [admin|worker] - 로컬 테스트 실행"
        exit 1
        ;;
esac

exit 0
