"""몬스터 데이터 품질 정리 스크립트.

중복/빈 데이터/이벤트 복제 몹을 is_hidden=1로 마킹.
삭제하지 않으므로 복구 가능.
"""
import sqlite3

from .db import get_connection, migrate_db


def cleanup_mobs(conn: sqlite3.Connection) -> dict:
    """몬스터 데이터 정리. 반환: 정리 통계."""
    stats = {
        "empty_hidden": 0,
        "exact_dupe_hidden": 0,
        "variant_hidden": 0,
        "total_hidden": 0,
        "canonical_count": 0,
    }

    # 0) 마이그레이션 (is_hidden 컬럼 추가)
    migrate_db(conn)

    # 1) 모든 몹 is_hidden 리셋
    conn.execute("UPDATE mobs SET is_hidden = 0")

    # 2) 빈 데이터 숨김 (레벨 0 + HP 0)
    cur = conn.execute(
        "UPDATE mobs SET is_hidden = 1 WHERE level = 0 AND hp = 0"
    )
    stats["empty_hidden"] = cur.rowcount

    # 3) 정확한 복제본 숨김: 같은 이름+레벨+HP인 9M+ 몹 중,
    #    <9M 정규 몹이 존재하면 9M+ 쪽을 숨김 (보스 제외)
    cur = conn.execute("""
        UPDATE mobs SET is_hidden = 1
        WHERE id >= 9000000
          AND is_hidden = 0
          AND is_boss = 0
          AND EXISTS (
            SELECT 1 FROM mobs m2
            WHERE m2.id < 9000000
              AND m2.name = mobs.name
              AND m2.level = mobs.level
              AND m2.hp = mobs.hp
              AND m2.is_hidden = 0
          )
    """)
    stats["exact_dupe_hidden"] = cur.rowcount

    # 4) 이름+레벨만 같은 9M+ 복제본도 숨김 (보스 제외)
    cur = conn.execute("""
        UPDATE mobs SET is_hidden = 1
        WHERE id >= 9000000
          AND is_hidden = 0
          AND is_boss = 0
          AND EXISTS (
            SELECT 1 FROM mobs m2
            WHERE m2.id < 9000000
              AND m2.name = mobs.name
              AND m2.level = mobs.level
              AND m2.level > 0
              AND m2.is_hidden = 0
          )
    """)
    stats["exact_dupe_hidden"] += cur.rowcount

    # 5) 9M+ only 그룹 중 같은 이름+레벨 중복 → 가장 작은 ID만 남기기 (보스 제외)
    cur = conn.execute("""
        UPDATE mobs SET is_hidden = 1
        WHERE id >= 9000000
          AND is_hidden = 0
          AND is_boss = 0
          AND id NOT IN (
            SELECT MIN(id) FROM mobs
            WHERE id >= 9000000 AND is_hidden = 0
            GROUP BY name, level
          )
          AND name IN (
            SELECT name FROM mobs
            WHERE id >= 9000000 AND is_hidden = 0
            GROUP BY name, level
            HAVING COUNT(*) > 1
          )
    """)
    stats["variant_hidden"] = cur.rowcount

    # 6) 같은 이름+같은 레벨인 남은 중복 → 가장 작은 ID만 남기기 (보스 제외)
    cur = conn.execute("""
        UPDATE mobs SET is_hidden = 1
        WHERE is_hidden = 0
          AND is_boss = 0
          AND id NOT IN (
            SELECT MIN(id) FROM mobs
            WHERE is_hidden = 0
            GROUP BY name, level
          )
          AND name IN (
            SELECT name FROM mobs
            WHERE is_hidden = 0
            GROUP BY name, level
            HAVING COUNT(*) > 1
          )
    """)

    # 7) 같은 이름+다른 레벨 변형 → 대표 1개만 남기기 (보스 제외)
    cur2 = conn.execute("""
        UPDATE mobs SET is_hidden = 1
        WHERE is_hidden = 0
          AND is_boss = 0
          AND id NOT IN (
            SELECT MIN(id) FROM mobs
            WHERE is_hidden = 0
            GROUP BY name
          )
          AND name IN (
            SELECT name FROM mobs
            WHERE is_hidden = 0
            GROUP BY name
            HAVING COUNT(*) > 1
          )
    """)
    stats["variant_hidden"] += cur.rowcount

    # 8) 보스와 동명의 일반 몹 → 보스 버전만 남기기
    cur = conn.execute("""
        UPDATE mobs SET is_hidden = 1
        WHERE is_hidden = 0
          AND is_boss = 0
          AND name IN (
            SELECT name FROM mobs WHERE is_boss = 1 AND is_hidden = 0
          )
    """)
    stats["variant_hidden"] += cur.rowcount

    conn.commit()

    # 통계
    stats["total_hidden"] = conn.execute(
        "SELECT COUNT(*) FROM mobs WHERE is_hidden = 1"
    ).fetchone()[0]
    stats["canonical_count"] = conn.execute(
        "SELECT COUNT(*) FROM mobs WHERE is_hidden = 0"
    ).fetchone()[0]

    return stats


def print_cleanup_report(conn: sqlite3.Connection) -> None:
    """정리 후 보고서 출력."""
    total = conn.execute("SELECT COUNT(*) FROM mobs").fetchone()[0]
    hidden = conn.execute("SELECT COUNT(*) FROM mobs WHERE is_hidden=1").fetchone()[0]
    visible = total - hidden

    dup_names = conn.execute("""
        SELECT COUNT(*) FROM (
            SELECT name FROM mobs WHERE is_hidden=0
            GROUP BY name HAVING COUNT(*) > 1
        )
    """).fetchone()[0]

    print(f"\n{'='*40}")
    print(f"몬스터 데이터 정리 보고서")
    print(f"{'='*40}")
    print(f"전체: {total}")
    print(f"숨김: {hidden}")
    print(f"노출: {visible}")
    print(f"남은 중복 이름: {dup_names}")

    # 남은 중복 상위 10개
    if dup_names > 0:
        rows = conn.execute("""
            SELECT name, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
            FROM mobs WHERE is_hidden=0
            GROUP BY name HAVING cnt > 1
            ORDER BY cnt DESC LIMIT 10
        """).fetchall()
        print(f"\n남은 중복 (상위 10):")
        for r in rows:
            print(f"  {r['name']} x{r['cnt']}: {r['ids']}")
