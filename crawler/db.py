"""SQLite 스키마 + FTS5 설정"""
import sqlite3
from pathlib import Path
from .config import DB_PATH, DATA_DIR

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    level_req INTEGER DEFAULT 0,
    job_req TEXT,
    stats TEXT,
    description TEXT,
    icon_url TEXT,
    source_url TEXT,
    last_crawled_at TEXT
);

CREATE TABLE IF NOT EXISTS mobs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 0,
    mp INTEGER DEFAULT 0,
    exp INTEGER DEFAULT 0,
    defense INTEGER DEFAULT 0,
    accuracy INTEGER DEFAULT 0,
    evasion INTEGER DEFAULT 0,
    is_boss INTEGER DEFAULT 0,
    icon_url TEXT,
    source_url TEXT,
    last_crawled_at TEXT
);

CREATE TABLE IF NOT EXISTS mob_drops (
    mob_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT,
    drop_rate REAL,
    PRIMARY KEY (mob_id, item_id),
    FOREIGN KEY (mob_id) REFERENCES mobs(id),
    FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS mob_spawns (
    mob_id INTEGER NOT NULL,
    map_id INTEGER NOT NULL,
    map_name TEXT,
    PRIMARY KEY (mob_id, map_id),
    FOREIGN KEY (mob_id) REFERENCES mobs(id),
    FOREIGN KEY (map_id) REFERENCES maps(id)
);

CREATE TABLE IF NOT EXISTS maps (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    street_name TEXT,
    area TEXT,
    return_map_id INTEGER,
    source_url TEXT,
    last_crawled_at TEXT
);

CREATE TABLE IF NOT EXISTS npcs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    map_id INTEGER,
    map_name TEXT,
    description TEXT,
    icon_url TEXT,
    source_url TEXT,
    last_crawled_at TEXT
);

CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    level_req INTEGER DEFAULT 0,
    npc_start TEXT,
    npc_end TEXT,
    rewards TEXT,
    description TEXT,
    source_url TEXT,
    last_crawled_at TEXT
);

CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT UNIQUE,
    category TEXT,
    content TEXT,
    published_at TEXT,
    last_crawled_at TEXT
);

-- 엔티티별 영문명 (멀티소스 지원)
CREATE TABLE IF NOT EXISTS entity_names_en (
    entity_type TEXT NOT NULL,
    entity_id   INTEGER NOT NULL,
    name_en     TEXT NOT NULL,
    source      TEXT NOT NULL,
    source_url  TEXT,
    last_crawled_at TEXT,
    PRIMARY KEY (entity_type, entity_id, source)
);

-- maplestory.io API 응답 캐시
CREATE TABLE IF NOT EXISTS maplestory_io_cache (
    entity_type TEXT NOT NULL,
    entity_id   INTEGER NOT NULL,
    name_en     TEXT,
    data_json   TEXT,
    last_crawled_at TEXT,
    PRIMARY KEY (entity_type, entity_id)
);

-- 티스토리 인덱스 링크 (빅뱅 이전/이후 분류)
CREATE TABLE IF NOT EXISTS tistory_index_links (
    url     TEXT PRIMARY KEY,
    section TEXT NOT NULL,
    title   TEXT,
    crawled INTEGER DEFAULT 0
);

-- Hidden Street 엔티티
CREATE TABLE IF NOT EXISTS hidden_street_entities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    slug        TEXT NOT NULL,
    name_en     TEXT NOT NULL,
    maple_id    INTEGER,
    data_json   TEXT,
    source_url  TEXT,
    last_crawled_at TEXT,
    UNIQUE(entity_type, slug)
);

CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_class TEXT NOT NULL,
    job_branch TEXT,
    skill_name TEXT NOT NULL,
    master_level INTEGER,
    skill_type TEXT,
    description TEXT,
    level_data TEXT,
    source_post_url TEXT,
    UNIQUE(job_class, skill_name)
);

CREATE TABLE IF NOT EXISTS bimae_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    job_class TEXT,
    level INTEGER,
    reason TEXT,
    image_url TEXT,
    author TEXT DEFAULT '익명',
    created_at TEXT DEFAULT (datetime('now')),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scroll_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    equipment_type TEXT NOT NULL,
    scroll_type TEXT NOT NULL,
    slot_count INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    total_stat_gain TEXT,
    scroll_detail TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    vote_counts_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    option_index INTEGER NOT NULL,
    voter_ip TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(poll_id, voter_ip)
);

CREATE TABLE IF NOT EXISTS maple_land_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT UNIQUE,
    board TEXT NOT NULL,
    category TEXT,
    title TEXT NOT NULL,
    content TEXT,
    content_html TEXT,
    url TEXT UNIQUE,
    published_at TEXT,
    last_crawled_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_type TEXT NOT NULL,
    participants_json TEXT NOT NULL,
    winner TEXT NOT NULL,
    result_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guild_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    author TEXT DEFAULT '추억길드',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guild_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL UNIQUE,
  job TEXT NOT NULL,
  level INTEGER NOT NULL,
  rank TEXT NOT NULL,
  alias TEXT,
  note TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boss_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boss_name TEXT NOT NULL,
  character_name TEXT NOT NULL,
  try_number INTEGER NOT NULL DEFAULT 1,
  cleared_at TEXT NOT NULL,
  drops TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boss_recruitments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boss_name TEXT NOT NULL,
  author TEXT NOT NULL,
  message TEXT,
  scheduled_at TEXT,
  max_members INTEGER DEFAULT 6,
  participants_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fee_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calc_type TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bot_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS free_board_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS free_board_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES free_board_posts(id)
);

CREATE TABLE IF NOT EXISTS free_board_comment_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  voter_ip TEXT NOT NULL,
  UNIQUE(comment_id, voter_ip),
  FOREIGN KEY (comment_id) REFERENCES free_board_comments(id)
);
"""

FTS_SCHEMA = """
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_type,
    entity_id UNINDEXED,
    name,
    content,
    tokenize='unicode61'
);
"""


def migrate_db(conn: sqlite3.Connection) -> None:
    """ALTER TABLE 마이그레이션 — 이미 존재하는 컬럼은 무시."""
    migrations = [
        ("mobs", "physical_damage", "INTEGER"),
        ("mobs", "magic_damage", "INTEGER"),
        ("mobs", "magic_defense", "INTEGER"),
        ("mobs", "speed", "INTEGER"),
        ("mobs", "is_undead", "INTEGER DEFAULT 0"),
        ("mobs", "spawn_time", "TEXT"),
        ("mobs", "is_hidden", "INTEGER DEFAULT 0"),
        ("items", "is_hidden", "INTEGER DEFAULT 0"),
        ("items", "attack_speed", "TEXT"),
        ("items", "price", "INTEGER"),
        ("items", "upgrade_slots", "INTEGER"),
        ("items", "overall_category", "TEXT"),
        ("maps", "is_town", "INTEGER DEFAULT 0"),
        ("maps", "mob_rate", "REAL"),
        ("maps", "portals_json", "TEXT"),
        ("npcs", "is_shop", "INTEGER DEFAULT 0"),
        ("npcs", "dialogue", "TEXT"),
        ("npcs", "related_quests", "TEXT"),
        ("npcs", "found_at", "TEXT"),
        ("guild_members", "alias", "TEXT"),
        ("community_polls", "allow_user_options", "INTEGER DEFAULT 0"),
        ("community_polls", "allow_multiple", "INTEGER DEFAULT 0"),
        ("community_polls", "deadline", "TEXT"),
    ]
    for table, column, col_type in migrations:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        except Exception:
            pass  # Column already exists
    conn.commit()

    # community_poll_votes UNIQUE 제약 변경: (poll_id, voter_ip) → (poll_id, voter_ip, option_index)
    try:
        # 기존 테이블에 UNIQUE(poll_id, voter_ip)만 있는지 확인
        info = conn.execute("PRAGMA table_info(community_poll_votes)").fetchall()
        col_names = [r[1] for r in info]
        if "option_index" in col_names:
            # 이미 option_index 컬럼 존재 → UNIQUE 제약 확인
            idx_info = conn.execute("PRAGMA index_list(community_poll_votes)").fetchall()
            needs_migrate = False
            for idx in idx_info:
                idx_cols = conn.execute(f"PRAGMA index_info({idx[1]})").fetchall()
                col_count = len(idx_cols)
                # UNIQUE(poll_id, voter_ip) = 2 columns 인 인덱스가 있으면 마이그레이션 필요
                if col_count == 2:
                    needs_migrate = True
                    break
            if needs_migrate:
                conn.executescript("""
                    CREATE TABLE IF NOT EXISTS community_poll_votes_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        poll_id INTEGER NOT NULL,
                        option_index INTEGER NOT NULL,
                        voter_ip TEXT NOT NULL,
                        created_at TEXT DEFAULT (datetime('now')),
                        UNIQUE(poll_id, voter_ip, option_index)
                    );
                    INSERT OR IGNORE INTO community_poll_votes_new (id, poll_id, option_index, voter_ip, created_at)
                        SELECT id, poll_id, option_index, voter_ip, created_at FROM community_poll_votes;
                    DROP TABLE community_poll_votes;
                    ALTER TABLE community_poll_votes_new RENAME TO community_poll_votes;
                """)
    except Exception:
        pass  # 마이그레이션 이미 완료 또는 불필요


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


GUILD_MEMBERS_SEED = [
    # (nickname, job, level, rank)
    ("푸두", "신궁", 172, "마스터"),
    ("요정주영", "비숍", 178, "부마스터"),
    ("추억놀이", "신궁", 172, "부마스터"),
    ("중디", "비숍", 199, "부마스터"),
    ("중2이이새", "새도어", 161, "부마스터"),
    ("딱팡", "히어로", 180, "부마스터"),
    ("동대문잡상인", "로그", 27, "부마스터"),
    ("추억보따리", "허밋", 77, "부마스터"),
    ("몰리형아", "신궁", 160, "길드원"),
    ("애플쏙", "다크나이트", 144, "길드원"),
    ("시박빡", "나이트로드", 153, "길드원"),
    ("슈쇼슈", "보우마스터", 171, "길드원"),
    ("운반비", "아크메이지", 169, "길드원"),
    ("알콩아린", "히어로", 125, "길드원"),
    ("타투문의", "신궁", 166, "길드원"),
    ("감튀살", "팔라딘", 165, "길드원"),
    ("세르사", "보우마스터", 164, "길드원"),
    ("귀엽덩이c", "메이지", 77, "길드원"),
    ("이구십팔", "아크메이지", 168, "길드원"),
    ("후하이", "보우마스터", 176, "길드원"),
    ("동으니", "나이트로드", 171, "길드원"),
    ("애국열사", "비숍", 153, "길드원"),
    ("검매", "신궁", 155, "길드원"),
    ("김형준91", "다크나이트", 154, "길드원"),
    ("추억치료사", "비숍", 159, "길드원"),
    ("정밀조준", "신궁", 160, "길드원"),
    ("판타그래프", "신궁", 167, "길드원"),
    ("들쥐", "비숍", 138, "길드원"),
    ("월급루팡꿀벌", "비숍", 170, "길드원"),
    ("법사는심부터", "프리스트", 113, "길드원"),
    ("PEL귀염둥이", "다크나이트", 135, "길드원"),
    ("구루취", "아크메이지", 138, "길드원"),
    ("로뽕", "나이트로드", 156, "길드원"),
    ("슬이생활", "아크메이지", 140, "길드원"),
    ("쫑뚤딩", "나이트로드", 161, "길드원"),
    ("박사야", "아크메이지", 131, "길드원"),
    ("쌍추쌈", "비숍", 152, "길드원"),
    ("징애", "다크나이트", 156, "길드원"),
    ("Eagle", "나이트로드", 165, "길드원"),
    ("박정희대통령", "비숍", 136, "길드원"),
    ("소리새", "비숍", 157, "길드원"),
    ("민야돌", "다크나이트", 151, "길드원"),
    ("별그대", "비숍", 148, "길드원"),
    ("테스론", "새도어", 160, "길드원"),
    ("그리운날", "비숍", 132, "길드원"),
    ("킷사텐", "신궁", 149, "길드원"),
    ("zi존잠홍v", "나이트로드", 138, "길드원"),
    ("ScyllaDB", "다크나이트", 178, "길드원"),
    ("름다", "히어로", 142, "길드원"),
    ("마카롱이좋아", "비숍", 143, "길드원"),
    ("허벅다리", "다크나이트", 140, "길드원"),
    ("프라", "신궁", 171, "길드원"),
    ("함아람", "나이트로드", 147, "길드원"),
    ("예종", "보우마스터", 167, "길드원"),
    ("작감", "신궁", 162, "길드원"),
    ("Achileus", "다크나이트", 171, "길드원"),
    ("펠사", "보우마스터", 169, "길드원"),
    ("헤등", "보우마스터", 167, "길드원"),
    ("치명적실수", "신궁", 173, "길드원"),
    ("오리등장", "비숍", 153, "길드원"),
    ("가다로진", "나이트로드", 159, "길드원"),
    ("클레해보자", "프리스트", 100, "길드원"),
    ("순뚜부조아", "히어로", 151, "길드원"),
    ("압압eee", "보우마스터", 158, "길드원"),
    ("아린보스", "보우마스터", 169, "길드원"),
    ("포효기사", "용기사", 104, "길드원"),
    ("추억갓메", "비숍", 149, "길드원"),
    ("추억시", "보우마스터", 144, "길드원"),
    ("터Rl", "나이트로드", 199, "길드원"),
    ("열심히팰께요", "나이트로드", 153, "길드원"),
    ("10퍼초벌", "보우마스터", 134, "길드원"),
    ("마법의우유", "히어로", 123, "길드원"),
    ("아슈파", "비숍", 174, "길드원"),
    ("삽삽", "비숍", 160, "길드원"),
    ("효성동주민", "보우마스터", 142, "길드원"),
    ("흥흥흥", "나이트로드", 160, "길드원"),
    ("사수해보까", "보우마스터", 162, "길드원"),
    ("포피자", "아크메이지", 131, "길드원"),
    ("해적아루루", "나이트로드", 151, "길드원"),
    ("곽주철", "다크나이트", 151, "길드원"),
    ("5300그랜저", "아크메이지", 144, "길드원"),
    ("JIWOOGAE", "비숍", 155, "길드원"),
    ("헌병", "저격수", 82, "길드원"),
    ("이슈기", "아크메이지", 133, "길드원"),
    ("대한k", "비숍", 169, "길드원"),
    ("은색궁수", "신궁", 155, "길드원"),
    ("빡꼼이", "나이트로드", 155, "길드원"),
    ("활럽", "신궁", 145, "길드원"),
    ("안벵벵", "나이트로드", 126, "길드원"),
    ("내란K", "비숍", 169, "길드원"),
    ("양키준", "클레릭", 45, "길드원"),
    ("블를", "새도어", 129, "길드원"),
    ("르사엘", "프리스트", 119, "부캐릭"),
    ("야마개돈다", "파이터", 54, "부캐릭"),
    ("꽈삐쥬", "새도어", 152, "부캐릭"),
    ("아해보세요", "아크메이지", 137, "부캐릭"),
    ("난이로운", "나이트로드", 131, "부캐릭"),
    ("냥만심", "비숍", 133, "부캐릭"),
    ("시조기부", "다크나이트", 132, "부캐릭"),
    ("곽미자", "프리스트", 113, "부캐릭"),
    ("치과의사", "프리스트", 108, "부캐릭"),
    ("한화강백호", "보우마스터", 145, "부캐릭"),
    ("쪼꼬맛우유", "프리스트", 110, "부캐릭"),
    ("쭈닝", "아크메이지", 125, "부캐릭"),
    ("추억메소", "어쌔신", 68, "부캐릭"),
    ("셔셔셔", "매지선", 28, "부캐릭"),
    ("곰탕탕", "팔라딘", 144, "부캐릭"),
    ("중디z", "히어로", 136, "부캐릭"),
    ("표봇", "허밋", 108, "부캐릭"),
    ("전사힘든가요", "다크나이트", 142, "부캐릭"),
    ("단원경찰서", "비숍", 137, "부캐릭"),
    ("난슬히어로", "히어로", 138, "부캐릭"),
    ("암마대답", "다크나이트", 142, "부캐릭"),
    ("양날토끼", "크루세이더", 71, "부캐릭"),
    ("운송비", "나이트로드", 135, "부캐릭"),
    ("마바사순", "나이트로드", 137, "부캐릭"),
    ("행탄", "신궁", 141, "부캐릭"),
    ("차홍이", "프리스트", 74, "부캐릭"),
    ("z짱쎈사람z", "히어로", 161, "부캐릭"),
    ("콩서리", "용기사", 92, "부캐릭"),
    ("VVVF", "프리스트", 100, "부캐릭"),
    ("삽업", "어쌔신", 42, "부캐릭"),
    ("추옥", "위자드", 54, "부캐릭"),
    ("딸기찹쌀뚝", "나이트", 110, "새싹"),
]


def seed_guild_members(conn: sqlite3.Connection) -> None:
    """guild_members 테이블이 비어 있을 때 초기 데이터 삽입."""
    count = conn.execute("SELECT COUNT(*) FROM guild_members").fetchone()[0]
    if count > 0:
        return
    conn.executemany(
        "INSERT OR IGNORE INTO guild_members (nickname, job, level, rank) VALUES (?, ?, ?, ?)",
        GUILD_MEMBERS_SEED,
    )
    conn.commit()


def seed_bot_settings(conn: sqlite3.Connection) -> None:
    """bot_settings 테이블 초기 시드."""
    defaults = [
        ("channel_id", "1302092927257804921"),
        ("notify_maple_land", "true"),
        ("notify_guild_post", "true"),
    ]
    for key, value in defaults:
        conn.execute(
            "INSERT OR IGNORE INTO bot_settings (key, value) VALUES (?, ?)",
            (key, value),
        )
    conn.commit()


def init_db() -> sqlite3.Connection:
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.executescript(FTS_SCHEMA)
    conn.commit()
    migrate_db(conn)
    seed_guild_members(conn)
    seed_bot_settings(conn)
    return conn


def rebuild_search_index(conn: sqlite3.Connection):
    """전문검색 인덱스 재구축 (영문명 포함)"""
    conn.execute("DELETE FROM search_index")

    # 영문명을 content에 포함시키기 위한 서브쿼리 헬퍼
    en_name_sub = """
        COALESCE(
            (SELECT GROUP_CONCAT(name_en, ' ')
             FROM entity_names_en
             WHERE entity_type = '{etype}' AND entity_id = {table}.id),
            ''
        )
    """

    conn.execute(f"""
        INSERT INTO search_index(entity_type, entity_id, name, content)
        SELECT 'item', id, name,
            COALESCE(category,'') || ' ' || COALESCE(subcategory,'') || ' '
            || COALESCE(description,'') || ' '
            || {en_name_sub.format(etype='item', table='items')}
        FROM items
    """)
    conn.execute(f"""
        INSERT INTO search_index(entity_type, entity_id, name, content)
        SELECT 'mob', id, name,
            {en_name_sub.format(etype='mob', table='mobs')}
        FROM mobs
    """)
    conn.execute(f"""
        INSERT INTO search_index(entity_type, entity_id, name, content)
        SELECT 'map', id, name,
            COALESCE(street_name,'') || ' ' || COALESCE(area,'') || ' '
            || {en_name_sub.format(etype='map', table='maps')}
        FROM maps
    """)
    conn.execute(f"""
        INSERT INTO search_index(entity_type, entity_id, name, content)
        SELECT 'npc', id, name,
            COALESCE(description,'') || ' '
            || {en_name_sub.format(etype='npc', table='npcs')}
        FROM npcs
    """)
    conn.execute(f"""
        INSERT INTO search_index(entity_type, entity_id, name, content)
        SELECT 'quest', id, name,
            COALESCE(description,'') || ' '
            || {en_name_sub.format(etype='quest', table='quests')}
        FROM quests
    """)
    conn.execute("""
        INSERT INTO search_index(entity_type, entity_id, name, content)
        SELECT 'blog', id, title, COALESCE(content,'')
        FROM blog_posts
    """)
    conn.execute("""
        INSERT INTO search_index(entity_type, entity_id, name, content)
        SELECT 'skill', id, skill_name,
            COALESCE(job_class,'') || ' ' || COALESCE(job_branch,'') || ' '
            || COALESCE(description,'')
        FROM skills
    """)
    conn.execute("""
        INSERT INTO search_index(entity_type, entity_id, name, content)
        SELECT 'news', id, title, COALESCE(content,'')
        FROM maple_land_posts
    """)
    conn.commit()
