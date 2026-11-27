#!/usr/bin/env python3
"""11/27 공식 네오도쿄 Part.1 반영. 기본 dry-run, --apply 로 적용.

공식 공개 필드만 도감에 저장한다. 원작 HP/EXP/드롭은 neo_tokyo.json에
참고용으로 분리하며 mob_drops/유저 테이블은 건드리지 않는다.
실제 퀘스트 ID·요구 재료·보상이 확인되지 않아 가짜 퀘스트 행을 만들지 않는다.
"""
from __future__ import annotations
import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def update_records(ref, kind, records):
    node = ref['entities'][kind]
    by_id = {r['id']: r for r in node['records']}
    for row in records:
        by_id[row['id']] = {**by_id.get(row['id'], {}), **row}
    node['records'] = list(by_id.values())
    node['total'] = len(node['records'])


def apply_patch(conn, data, ref, notes):
    source = data['source']
    def name(kind, id, kr):
        # kms도 등록: 기존 일부 상세/검색 경로가 kms 이름을 조회한다.
        for origin in ['kms', 'mapleland-current']:
            conn.execute('''INSERT INTO entity_names_en
                (entity_type,entity_id,name_en,source,source_url,last_crawled_at)
                VALUES (?,?,?,?,?,?) ON CONFLICT(entity_type,entity_id,source)
                DO UPDATE SET name_en=excluded.name_en,source_url=excluded.source_url''',
                (kind,id,kr,origin,source,data['updated_at']))
    for mob in data['monsters']:
        conn.execute('''INSERT INTO mobs
            (id,name,level,hp,mp,exp,defense,accuracy,evasion,is_boss,source_url)
            VALUES (?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,?,?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name,level=excluded.level,source_url=excluded.source_url''',
            (mob['id'],mob['name'],mob['level'],int(mob['boss']),source))
        name('mob',mob['id'],mob['name'])
    update_records(ref,'mobs',[{'id':m['id'],'name_kr':m['name'],'level':m['level'],'source_url':source} for m in data['monsters']])
    maps = [m for a in data['areas'] for m in a['maps'] if m['id']]
    for m in maps:
        conn.execute('''INSERT INTO maps (id,name,street_name,area,source_url,is_town)
            VALUES (?,?,'네오도쿄','네오도쿄',?,?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name,street_name=excluded.street_name,area=excluded.area,source_url=excluded.source_url''',
            (m['id'],m['name'],source,int(m['id'] in (802000101,802000500))))
        name('map',m['id'],m['name'])
    update_records(ref,'maps',[{'id':m['id'],'name_kr':'네오도쿄: '+m['name'],'source_url':source} for m in maps])
    for item in data['items']:
        if not item['id']:
            continue
        id=item['id'];name('item',id,item['name'])
        conn.execute('''INSERT INTO items (id,name,category,subcategory,level_req,source_url)
            VALUES (?,?,?,?,NULL,?) ON CONFLICT(id) DO NOTHING''',
            (id,item['name'],'armor' if id==1092049 else 'consumable','방패' if id==1092049 else '표창' if id==2070016 else '불릿',source))
        note={'name_kr':item['name'],'level':0,'publish':True,'acquisition':item['method'],
              'note':'11/27 공식 출시 확인. 기존 도감 옵션은 원작 참고이며 메이플랜드 완성품 옵션·제작 재료는 확인 중입니다.',
              'sources':[{'label':'11/27 공식 패치노트','url':source}]}
        if id==2070016:
            note['steps']=['아키하바라 사령실의 노란에게 제조법 안내를 확인합니다.','게임 화면 제보상 제조 매뉴얼 안내 수수료는 은화 2,500개입니다.','이는 완제품 제작 재료 전체가 아닙니다. 재료·공격력·교환 여부는 확인 중입니다.']
            note['sources'].append({'label':'11/27 게임 화면 제보','url':data['crystal_ilbi']['manual_source']})
        notes['items'][str(id)]=note
    update_records(ref,'items',[{'id':i['id'],'name_kr':i['name'],'source_url':source} for i in data['items'] if i['id']])
    # 단검 Dragon Kanzir(1332052)와 방패를 혼동하지 않는다.
    name('item',1092050,'칸쟈르')
    update_records(ref,'items',[{'id':1092050,'name_kr':'칸쟈르','source_url':source}])
    from crawler.db import rebuild_search_index
    rebuild_search_index(conn)


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--apply',action='store_true')
    args=ap.parse_args()
    data=json.loads((ROOT/'data/neo_tokyo.json').read_text())
    print(f"일반/보스 {len(data['monsters'])}종, ID 대조 맵 7개, 제작 품목 6종 중 ID 대조 3종")
    print('HP/EXP/드롭률·보스 단계·미확인 퀘스트/레시피는 확정값으로 등록하지 않습니다.')
    if not args.apply:
        print('dry-run: 변경 없음. --apply 로 적용합니다.')
        return
    ref_path=ROOT/'data/mapleland_reference.json';notes_path=ROOT/'data/equipment_notes.json'
    ref=json.loads(ref_path.read_text());notes=json.loads(notes_path.read_text())
    with sqlite3.connect(ROOT/'data/maple.db') as conn:
        apply_patch(conn,data,ref,notes)
    for path,value in [(ref_path,ref),(notes_path,notes)]:
        path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    # init_db의 이름 보정은 standalone 파일을 우선 사용한다.
    for kind in ['mobs', 'maps', 'items']:
        path = ROOT / f'data/mapleland_{kind}.json'
        standalone = json.loads(path.read_text())
        rows = {r['id']: r for r in standalone[kind]}
        for row in ref['entities'][kind]['records']:
            if row.get('source_url') == data['source']:
                rows[row['id']] = {**rows.get(row['id'], {}), **row}
        standalone[kind] = list(rows.values())
        if 'total' in standalone:
            standalone['total'] = len(standalone[kind])
        path.write_text(json.dumps(standalone,ensure_ascii=False,indent=1 if kind == 'items' else 2)+'\n')
    print('적용 완료: 검색 인덱스 재생성. 유저 테이블 및 드롭 실측 데이터 변경 없음.')


if __name__=='__main__':
    main()
