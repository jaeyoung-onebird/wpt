"""NFT Badge Image Generation Service"""
import os
from pathlib import Path
from typing import Optional
from datetime import datetime

from .badge_icons import get_badge_icon_svg

# 템플릿 유형
TEMPLATE_TYPES = ['minimal', 'medal', 'cert']

# 등급별 색상 정의
GRADE_COLORS = {
    "COMMON": {
        "start": "#4A5568",
        "end": "#2D3748",
        "badge": "#718096",
        "label": "일반"
    },
    "RARE": {
        "start": "#2B6CB0",
        "end": "#1A365D",
        "badge": "#3182CE",
        "label": "희귀"
    },
    "EPIC": {
        "start": "#6B46C1",
        "end": "#44337A",
        "badge": "#805AD5",
        "label": "영웅"
    },
    "LEGENDARY": {
        "start": "#B7791F",
        "end": "#744210",
        "badge": "#D69E2E",
        "label": "전설"
    }
}

# 배지 유형별 등급 매핑
BADGE_GRADE_MAPPING = {
    "WORK_COUNT": {
        1: "COMMON",      # 첫 근무 완료
        2: "RARE",        # 10회 달성
        3: "EPIC",        # 50회 달성
        4: "LEGENDARY",   # 100회 달성
    },
    "TRUST": {
        1: "RARE",        # 신뢰할 수 있는 근무자
        2: "EPIC",        # 믿음직한 프로
        3: "LEGENDARY",   # 최고 신뢰 등급
    },
    "BLOCKCHAIN": {
        1: "COMMON",      # 블록체인 데뷔
        2: "RARE",        # 블록체인 프로
        3: "EPIC",        # 블록체인 마스터
    },
    "PROFILE": {
        1: "COMMON",      # 프로필 완성
    },
    "PHOTO": {
        1: "COMMON",      # 얼굴 등록 완료
    },
    "PROJECT": {
        1: "RARE",        # 프로젝트 참여 (기본)
    },
}


def get_badge_grade(badge_type: str, badge_level: int, grade_override: str = None) -> str:
    """배지 유형과 레벨로 등급 조회"""
    if grade_override and grade_override in GRADE_COLORS:
        return grade_override
    return BADGE_GRADE_MAPPING.get(badge_type, {}).get(badge_level, "COMMON")


def get_grade_colors(grade: str) -> dict:
    """등급별 색상 정보 조회"""
    return GRADE_COLORS.get(grade, GRADE_COLORS["COMMON"])


def load_svg_template(template_type: str = 'minimal') -> str:
    """SVG 템플릿 파일 로드"""
    if template_type not in TEMPLATE_TYPES:
        template_type = 'minimal'

    template_path = Path(__file__).parent.parent / "templates" / f"badge_{template_type}.svg"
    if not template_path.exists():
        # 폴백: badge_card.svg 사용
        template_path = Path(__file__).parent.parent / "templates" / "badge_card.svg"

    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()


def render_badge_svg(
    badge_type: str,
    badge_level: int,
    title: str,
    description: str,
    icon: str,
    earned_at: datetime,
    worker_id: int,
    worker_name: Optional[str] = None,
    template_type: str = 'minimal',
    event_name: Optional[str] = None,
    grade_override: Optional[str] = None
) -> str:
    """
    배지 데이터로 SVG 이미지 생성

    Args:
        badge_type: 배지 유형 (WORK_COUNT, TRUST, BLOCKCHAIN, PROJECT 등)
        badge_level: 배지 레벨
        title: 배지 타이틀
        description: 배지 설명
        icon: 이모지 아이콘
        earned_at: 획득 일시
        worker_id: 근무자 ID
        worker_name: 근무자 이름 (선택)
        template_type: 템플릿 유형 (minimal, medal, cert)
        event_name: 이벤트명 (프로젝트 배지용)
        grade_override: 등급 강제 지정

    Returns:
        렌더링된 SVG 문자열
    """
    # 등급 및 색상 가져오기
    grade = get_badge_grade(badge_type, badge_level, grade_override)
    colors = get_grade_colors(grade)

    # 템플릿 로드
    template = load_svg_template(template_type)

    # 날짜 포맷
    if isinstance(earned_at, datetime):
        date_str = earned_at.strftime("%Y년 %m월 %d일")
    else:
        date_str = str(earned_at)[:10] if earned_at else ""

    # SVG 아이콘 가져오기
    icon_svg = get_badge_icon_svg(badge_type, badge_level)

    # 변수 치환
    replacements = {
        "{{icon}}": icon or "🏅",
        "{{icon_svg}}": icon_svg,
        "{{title}}": title or "",
        "{{description}}": description or "",
        "{{grade_label}}": colors["label"],
        "{{grade_color_start}}": colors["start"],
        "{{grade_color_end}}": colors["end"],
        "{{grade_badge_color}}": colors["badge"],
        "{{earned_date}}": date_str,
        "{{worker_id}}": f"WP-{worker_id:05d}" if worker_id else "",
        "{{worker_name}}": worker_name or "",
        "{{event_name}}": event_name or "",
    }

    svg = template
    for key, value in replacements.items():
        svg = svg.replace(key, str(value))

    return svg


def render_project_badge_svg(
    title: str,
    description: str,
    icon: str,
    event_name: str,
    earned_at: datetime,
    worker_id: int,
    grade: str = "RARE",
    template_type: str = "cert"
) -> str:
    """프로젝트 배지 SVG 생성 (간편 함수)"""
    return render_badge_svg(
        badge_type="PROJECT",
        badge_level=1,
        title=title,
        description=description,
        icon=icon,
        earned_at=earned_at,
        worker_id=worker_id,
        template_type=template_type,
        event_name=event_name,
        grade_override=grade
    )


def generate_nft_metadata(
    badge_id: int,
    badge_type: str,
    badge_level: int,
    title: str,
    description: str,
    icon: str,
    earned_at: datetime,
    worker_id: int,
    image_url: str,
    event_name: Optional[str] = None
) -> dict:
    """
    NFT 메타데이터 JSON 생성 (OpenSea 호환)

    Args:
        badge_id: 배지 DB ID
        badge_type: 배지 유형
        badge_level: 배지 레벨
        title: 배지 타이틀
        description: 배지 설명
        icon: 이모지 아이콘
        earned_at: 획득 일시
        worker_id: 근무자 ID
        image_url: 이미지 URL (IPFS 또는 HTTP)
        event_name: 이벤트명 (프로젝트 배지용)

    Returns:
        OpenSea 호환 메타데이터 딕셔너리
    """
    grade = get_badge_grade(badge_type, badge_level)
    colors = get_grade_colors(grade)

    attributes = [
        {
            "trait_type": "Badge Type",
            "value": badge_type
        },
        {
            "trait_type": "Level",
            "value": badge_level,
            "display_type": "number"
        },
        {
            "trait_type": "Grade",
            "value": colors["label"]
        },
        {
            "trait_type": "Earned Date",
            "value": earned_at.strftime("%Y-%m-%d") if isinstance(earned_at, datetime) else str(earned_at)[:10]
        },
        {
            "trait_type": "Worker ID",
            "value": f"WP-{worker_id:05d}"
        }
    ]

    if event_name:
        attributes.append({
            "trait_type": "Event",
            "value": event_name
        })

    return {
        "name": title,
        "description": description,
        "image": image_url,
        "external_url": f"https://workproof.app/badges/{badge_id}",
        "attributes": attributes,
        "properties": {
            "category": "achievement",
            "creators": [
                {
                    "address": "WorkProof Chain",
                    "share": 100
                }
            ]
        }
    }
