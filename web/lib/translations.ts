/** 영문 카테고리 → 한국어 매핑 */
export const CATEGORY_KR: Record<string, string> = {
  // 장비
  "Armor": "방어구",
  "One-Handed Weapon": "한손무기",
  "Two-Handed Weapon": "양손무기",
  "Weapon": "무기",
  "Accessory": "장신구",
  "Projectile": "투사체",
  // 소비/기타
  "Consumable": "소비",
  "Scroll": "주문서",
  "Armor Scroll": "방어구 주문서",
  "Weapon Scroll": "무기 주문서",
  "Special Scroll": "특수 주문서",
  // 캐릭터/외형
  "Character": "캐릭터",
  "Character Modification": "캐릭터 변경",
  "Appearance": "외형",
  // 기타
  "Other": "기타",
  "Cash Shop": "캐시샵",
  "Crafting": "제작",
  "Monster/Familiar": "몬스터/소환수",
  "Equipment Modification": "장비 변경",
  "Messenger and Social": "메신저/소셜",
  "Free Market": "자유시장",
  "Random Reward": "랜덤 보상",
  "Mount": "탈것",
  "Pet": "펫",
  "Tablet": "태블릿",
  "Time Saver": "시간절약",
};

/** 영문 서브카테고리 → 한국어 매핑 */
export const SUBCATEGORY_KR: Record<string, string> = {
  // 한손무기
  "One-Handed Sword": "한손검",
  "One-Handed Axe": "한손도끼",
  "One-Handed Mace": "한손둔기",
  "Dagger": "단검",
  "Wand": "완드",
  "Staff": "스태프",
  "Claw": "아대",
  // 양손무기
  "Two-Handed Sword": "두손검",
  "Two-Handed Axe": "두손도끼",
  "Two-Handed Mace": "두손둔기",
  "Spear": "창",
  "Polearm": "폴암",
  "Bow": "활",
  "Crossbow": "석궁",
  "Gun": "총",
  "Knuckle": "너클",
  // 방어구
  "Hat": "모자",
  "Top": "상의",
  "Bottom": "하의",
  "Overall": "한벌옷",
  "Shoes": "신발",
  "Gloves": "장갑",
  "Shield": "방패",
  "Cape": "망토",
  // 장신구
  "Ring": "반지",
  "Pendant": "펜던트",
  "Face Accessory": "얼굴장식",
  "Eye Accessory": "눈장식",
  "Earring": "귀걸이",
  "Belt": "벨트",
  "Medal": "메달",
  // 기타
  "Throwing Star": "표창",
  "Arrow": "화살",
  "Bullet": "총알",
};

/** 직업 코드/영문 → 한국어 */
export const JOB_KR: Record<string, string> = {
  "Warrior": "전사",
  "Magician": "마법사",
  "Bowman": "궁수",
  "Thief": "도적",
  "Pirate": "해적",
  "전사": "전사",
  "마법사": "마법사",
  "궁수": "궁수",
  "도적": "도적",
  "해적": "해적",
};

/** 카테고리명을 한국어로 변환 (없으면 원문 반환) */
export function toCategoryKr(name: string | null | undefined): string {
  if (!name) return "";
  return CATEGORY_KR[name] || name;
}

/** 서브카테고리명을 한국어로 변환 */
export function toSubcategoryKr(name: string | null | undefined): string {
  if (!name) return "";
  return SUBCATEGORY_KR[name] || name;
}
