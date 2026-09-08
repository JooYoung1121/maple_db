"""Field-level provenance for the 2026-09-08 audit. Never infer live values."""
import json

COMMUNITY = 'https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no='
MAYA_CONDITIONS = ['물컹물컹한 액체 50개 (슬라임)', '나뭇잎 50개 (다크 스텀프)',
                   '옥토퍼스의 다리 20개 (옥토퍼스)', '죽은자의 부적 40개 (좀비버섯) → 만지에게 아르콘의 피 1개로 교환']
MAYA_SOURCES = ['https://goodman.tistory.com/5896',
               'https://tipsu.tistory.com/entry/메이플랜드-퀘스트「마야와-이상한-약」공략-갈색삿갓']
EXP_VALUES = {7150000: 452, 7150001: 472, 7150002: 488, 7150004: 630,
              8105001: 1500, 8105002: 1780, 8105003: 2100, 8105004: 2300, 8105005: 3050}


def mob_evidence(mob, spawns):
    fields = []
    def add(field, status, note, source):
        fields.append(dict(field=field, status=status, note=note, source_url=source, checked_at='2026-09-08'))
    if mob['id'] in EXP_VALUES and mob.get('exp') == EXP_VALUES[mob['id']]:
        add('EXP', 'community', '버닝 월드 관측값 × 2/3 본섭 환산. 본섭 직접 측정값이 아님.', COMMUNITY + '3943694')
    if mob['id'] == 8105005:
        for field, value in [('hp', 57000), ('mp', 250)]:
            if mob.get(field) == value:
                add(field.upper(), 'community', '커뮤니티 몬스터북 스크린샷 근거.', COMMUNITY + '3942833')
        if not spawns:
            add('출현 맵', 'unknown', '정확한 메이플랜드 맵명·ID 대조 대기. 출현하지 않는다는 뜻이 아님.', None)
    if mob['id'] == 7150000 and mob.get('hp') == 15000:
        add('HP', 'community', '글쓴이의 약 15,000 추정치. 확정 정수 측정값이 아님.', COMMUNITY + '3943694')
    if any(310000000 <= s['id'] <= 319999999 for s in spawns):
        add('출현 맵', 'original', '원작 지역 구조 기반 수동 매핑 포함. 메이플랜드 실측과 구별.', 'https://archive.maplestory.nexon.com/News/Update/147?p=12')
    if fields:
        add('그 외 수치', 'original', '별도 근거가 없는 필드는 기존 원작 참고 데이터. 최신 메이플랜드 확정값으로 간주하지 마세요.', mob.get('source_url'))
    return fields


def annotate_quest(quest):
    """Quarantine known placeholders at the API boundary, retain raw import in DB."""
    note = quest.get('note') or ''
    placeholder = '[배틀메이지 9/7 리서치]' in note or (
        quest.get('area') == '아모리아' and quest.get('id') in range(543, 549))
    warnings = []
    if placeholder:
        for field in ['exp_reward', 'meso_reward']:
            if quest.get(field) == 0:
                quest[field] = None
        warnings.append('세부 보상 미확인: 빈 값은 보상이 0이라는 뜻이 아닙니다.')
        quest['data_status'] = 'unconfirmed'
    conditions = quest.get('quest_conditions') or []
    if isinstance(conditions, str):
        try:
            conditions = json.loads(conditions)
        except ValueError:
            conditions = []
    if not isinstance(conditions, list):
        conditions = []
    if any('드롭 아이템' in str(c) for c in conditions):
        quest['unverified_conditions'] = conditions
        quest['quest_conditions'] = []
        warnings.append('수집 과정에서 재료명이 소실되어 수행 조건을 보류했습니다. 인게임 퀘스트창 확인이 필요합니다.')
        quest['data_status'] = 'needs_review'
    if quest.get('id') == 9 and quest.get('name') == '마야와 이상한 약' and conditions == MAYA_CONDITIONS:
        quest['data_sources'] = MAYA_SOURCES
        warnings.append('재료명은 2024년 메이플랜드 공략 2건을 교차 확인해 복구했습니다(2026-09-08 확인). 현재 인게임 퀘스트창이 우선입니다.')
    if quest.get('meso_reward') and 1 <= quest['meso_reward'] <= 5:
        warnings.append('소액 메소 보상은 원문 대조 대기입니다. 오입력 여부를 확정하지 않았습니다.')
    quest['data_warnings'] = warnings
    return quest
