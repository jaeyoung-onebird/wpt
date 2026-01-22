import os
from dotenv import load_dotenv

load_dotenv('config/.env')

print("현재 설정된 Worker Bot Username:", os.getenv('WORKER_BOT_USERNAME'))
print("\n텔레그램에서 Worker Bot(@BotFather)의 username을 확인하고,")
print("config/.env 파일의 WORKER_BOT_USERNAME을 수정하세요.")
print("\n예: @your_worker_bot → WORKER_BOT_USERNAME=your_worker_bot")
