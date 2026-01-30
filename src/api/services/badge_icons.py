"""
컬러풀한 NFT 스타일 배지 아이콘 정의
각 배지 유형별로 고유한 SVG 아이콘 디자인
"""

# 아이콘 SVG 정의 (badge_type, badge_level) -> SVG 패스
BADGE_ICONS = {
    # ===== 사진 등록 - 카메라 아이콘 (민트/청록) =====
    ("PHOTO", 1): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#00D9FF"/>
                <stop offset="100%" style="stop-color:#00B4D8"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <rect x="8" y="14" width="34" height="24" rx="4" fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <circle cx="25" cy="26" r="8" fill="#fff" opacity="0.3"/>
            <circle cx="25" cy="26" r="5" fill="#fff"/>
            <rect x="30" y="16" width="8" height="4" rx="1" fill="#fff" opacity="0.6"/>
            <circle cx="12" cy="18" r="2" fill="#fff" opacity="0.8"/>
        </g>
    """,

    # ===== 프로필 완성 - 사람 아이콘 (핑크/마젠타) =====
    ("PROFILE", 1): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FF6B9D"/>
                <stop offset="100%" style="stop-color:#C44569"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <circle cx="25" cy="18" r="10" fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <path d="M8,42 Q8,28 25,28 Q42,28 42,42" fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <circle cx="25" cy="18" r="4" fill="#fff" opacity="0.5"/>
        </g>
    """,

    # ===== 근무 횟수 Level 1 - 서클 스타 (그린) =====
    ("WORK_COUNT", 1): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#48BB78"/>
                <stop offset="100%" style="stop-color:#2F855A"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <circle cx="25" cy="25" r="18" fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <text x="25" y="32" text-anchor="middle" font-size="20" font-weight="bold" fill="#fff">1</text>
        </g>
    """,

    # ===== 근무 횟수 Level 2 - 별 아이콘 (블루) =====
    ("WORK_COUNT", 2): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#63B3ED"/>
                <stop offset="100%" style="stop-color:#3182CE"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <polygon points="25,5 30,20 46,20 33,30 38,45 25,35 12,45 17,30 4,20 20,20"
                     fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <circle cx="25" cy="25" r="6" fill="#fff" opacity="0.4"/>
        </g>
    """,

    # ===== 근무 횟수 Level 3 - 더블 스타 (퍼플) =====
    ("WORK_COUNT", 3): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#9F7AEA"/>
                <stop offset="100%" style="stop-color:#6B46C1"/>
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)" filter="url(#glow)">
            <polygon points="25,3 29,17 44,17 32,26 36,40 25,32 14,40 18,26 6,17 21,17"
                     fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <polygon points="25,12 27,19 34,19 28,24 30,31 25,27 20,31 22,24 16,19 23,19"
                     fill="#fff" opacity="0.5"/>
        </g>
    """,

    # ===== 근무 횟수 Level 4 - 크라운 스타 (골드) =====
    ("WORK_COUNT", 4): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#F6E05E"/>
                <stop offset="50%" style="stop-color:#ECC94B"/>
                <stop offset="100%" style="stop-color:#D69E2E"/>
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)" filter="url(#glow)">
            <polygon points="25,2 30,15 45,15 33,25 38,40 25,30 12,40 17,25 5,15 20,15"
                     fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <circle cx="25" cy="20" r="5" fill="#fff"/>
            <circle cx="15" cy="22" r="3" fill="#fff" opacity="0.6"/>
            <circle cx="35" cy="22" r="3" fill="#fff" opacity="0.6"/>
        </g>
    """,

    # ===== 신뢰도 Level 1 - 체크 쉴드 (틸) =====
    ("TRUST", 1): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#38B2AC"/>
                <stop offset="100%" style="stop-color:#2C7A7B"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <path d="M25,4 L42,12 L42,26 Q42,40 25,46 Q8,40 8,26 L8,12 Z"
                  fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <polyline points="15,25 22,32 35,18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
        </g>
    """,

    # ===== 신뢰도 Level 2 - 더블 쉴드 (인디고) =====
    ("TRUST", 2): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667EEA"/>
                <stop offset="100%" style="stop-color:#5A67D8"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <path d="M25,2 L44,10 L44,25 Q44,42 25,48 Q6,42 6,25 L6,10 Z"
                  fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <path d="M25,10 L38,15 L38,25 Q38,35 25,40 Q12,35 12,25 L12,15 Z"
                  fill="#fff" opacity="0.3"/>
            <polyline points="17,26 23,32 33,20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        </g>
    """,

    # ===== 신뢰도 Level 3 - 왕관 (골드) =====
    ("TRUST", 3): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#F6AD55"/>
                <stop offset="100%" style="stop-color:#DD6B20"/>
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)" filter="url(#glow)">
            <path d="M6,38 L10,18 L18,28 L25,8 L32,28 L40,18 L44,38 Z"
                  fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <rect x="8" y="38" width="34" height="6" rx="2" fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <circle cx="25" cy="18" r="4" fill="#fff"/>
            <circle cx="14" cy="24" r="3" fill="#fff" opacity="0.7"/>
            <circle cx="36" cy="24" r="3" fill="#fff" opacity="0.7"/>
        </g>
    """,

    # ===== 블록체인 Level 1 - 체인 링크 (그레이블루) =====
    ("BLOCKCHAIN", 1): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#718096"/>
                <stop offset="100%" style="stop-color:#4A5568"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <rect x="6" y="18" width="16" height="14" rx="7" fill="none" stroke="url(#icon-grad)" stroke-width="4"/>
            <rect x="28" y="18" width="16" height="14" rx="7" fill="none" stroke="url(#icon-grad)" stroke-width="4"/>
            <rect x="17" y="22" width="16" height="6" rx="3" fill="url(#icon-grad)"/>
        </g>
    """,

    # ===== 블록체인 Level 2 - 헥사곤 (사이언) =====
    ("BLOCKCHAIN", 2): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#4FD1C5"/>
                <stop offset="100%" style="stop-color:#319795"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <polygon points="25,4 42,14 42,34 25,44 8,34 8,14"
                     fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <polygon points="25,12 34,18 34,30 25,36 16,30 16,18"
                     fill="#fff" opacity="0.3"/>
            <circle cx="25" cy="24" r="5" fill="#fff"/>
        </g>
    """,

    # ===== 블록체인 Level 3 - 다이아몬드 (퍼플핑크) =====
    ("BLOCKCHAIN", 3): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ED64A6"/>
                <stop offset="50%" style="stop-color:#B83280"/>
                <stop offset="100%" style="stop-color:#97266D"/>
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)" filter="url(#glow)">
            <polygon points="25,4 44,18 25,46 6,18"
                     fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <polygon points="25,4 35,18 25,35 15,18"
                     fill="#fff" opacity="0.2"/>
            <polygon points="25,10 30,18 25,28 20,18"
                     fill="#fff" opacity="0.3"/>
        </g>
    """,

    # ===== 프로젝트 배지 (기본) - 메달 (골드/블루) =====
    ("PROJECT", 1): """
        <defs>
            <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#F6AD55"/>
                <stop offset="100%" style="stop-color:#3182CE"/>
            </linearGradient>
        </defs>
        <g transform="translate(-25, -25) scale(1.2)">
            <circle cx="25" cy="28" r="16" fill="url(#icon-grad)" stroke="#fff" stroke-width="3"/>
            <polygon points="20,8 25,18 30,8" fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
            <circle cx="25" cy="28" r="8" fill="#fff" opacity="0.3"/>
            <text x="25" y="33" text-anchor="middle" font-size="14" font-weight="bold" fill="#fff">P</text>
        </g>
    """,
}

# 기본 아이콘 (정의되지 않은 경우)
DEFAULT_ICON = """
    <defs>
        <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#A0AEC0"/>
            <stop offset="100%" style="stop-color:#718096"/>
        </linearGradient>
    </defs>
    <g transform="translate(-25, -25) scale(1.2)">
        <circle cx="25" cy="25" r="18" fill="url(#icon-grad)" stroke="#fff" stroke-width="2"/>
        <circle cx="25" cy="25" r="8" fill="#fff" opacity="0.4"/>
    </g>
"""


def get_badge_icon_svg(badge_type: str, badge_level: int) -> str:
    """배지 유형과 레벨에 맞는 SVG 아이콘 반환"""
    return BADGE_ICONS.get((badge_type, badge_level), DEFAULT_ICON)
