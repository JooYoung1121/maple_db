"""크롤링 설정"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "maple.db"
CACHE_DIR = DATA_DIR / "cache"

MAPLEDB_BASE = "https://mapledb.kr"
TISTORY_BASE = "https://maplekibun.tistory.com"
MAPLESTORY_IO_BASE = "https://maplestory.io/api"
MAPLESTORY_IO_VERSION_GMS = "92"   # pre-BigBang GMS (빅뱅 직전, 메인 데이터소스)
MAPLESTORY_IO_VERSION_KMS = "284"  # KMS (한국어 이름 매칭용)
HIDDEN_STREET_BASE = "https://bbb.hidden-street.net"

RATE_LIMIT = {
    "mapledb.kr": 1.0,       # 초당 1요청
    "tistory.com": 2.0,      # 초당 0.5요청
    "maplestory.io": 0.5,    # 초당 2요청
    "bbb.hidden-street.net": 3.0,  # 초당 ~0.33요청
}

CRAWL_STALE_DAYS = 7       # 이 기간 내 크롤링된 건 스킵
MAX_RETRIES = 3
TIMEOUT = 30.0

ENTITY_TYPES = ["items", "mobs", "maps", "npcs", "quests"]

LIST_URLS = {
    "items": f"{MAPLEDB_BASE}/item.php",
    "mobs":  f"{MAPLEDB_BASE}/mob.php",
    "maps":  f"{MAPLEDB_BASE}/map.php",
    "npcs":  f"{MAPLEDB_BASE}/npc.php",
    "quests": f"{MAPLEDB_BASE}/quest.php",
}

SEARCH_URL = f"{MAPLEDB_BASE}/search.php"  # ?q={id}&t={type}

TYPE_CODES = {
    "items": "i",
    "mobs": "m",
    "maps": "a",
    "npcs": "n",
    "quests": "q",
}
