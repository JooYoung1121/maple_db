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
    ]
    for table, column, col_type in migrations:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        except Exception:
            pass  # Column already exists
    conn.commit()


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> sqlite3.Connection:
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.executescript(FTS_SCHEMA)
    conn.commit()
    migrate_db(conn)
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
    conn.commit()
