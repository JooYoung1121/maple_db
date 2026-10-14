/* 엔티티 아이콘 URL 단일 소스.
 *
 * 아이템·몬스터·NPC 아이콘은 서버 프록시(/api/icon/{type}/{id})를 통해 받는다.
 * 프록시는 DB의 icon_url(없으면 gms/92 기본 URL)을 받아 PNG 검증 후 파일 캐시로 고정하고 30일 캐시 헤더를 붙인다.
 * 2026-10-14 전수 점검에서 maplestory.io 직접 요청이 300여 건 일시 500·타임아웃을 냈기 때문에
 * 상세·목록·검색 어디서든 CDN 핫링크 대신 이 헬퍼를 쓴다. (혼줌·주문서 시뮬·시세 페이지는 이미 프록시 사용)
 */
export type IconEntity = "item" | "mob" | "npc";

export function entityIconUrl(type: IconEntity, id: number): string {
  return `/api/icon/${type}/${id}`;
}

/** 검색 결과의 entity_type("item"|"mob"|"npc"|그 외) → 프록시 URL, 아이콘이 없는 타입은 원본 값 그대로 */
export function suggestionIconUrl(entityType: string, entityId: number, fallback: string | null): string | null {
  if (entityType === "item" || entityType === "mob" || entityType === "npc") return entityIconUrl(entityType, entityId);
  return fallback;
}

/** 원본·프록시 모두 실패한 아이콘은 깨진 이미지 대신 자리만 비운다 */
export function hideIconOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = "hidden";
}
