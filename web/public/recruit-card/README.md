# 구인구직 카드 템플릿 아트

사전 생성된 배경 아트(1080×1080 권장, PNG). 파일이 존재하면 카드 메이커의
템플릿 선택지에 자동 노출되고, 없으면 해당 템플릿은 숨겨진다.

- tpl-darkknight.png — 다크 퍼플/번개 테마
- tpl-pastel.png — 픽셀 파스텔 밤하늘 테마

생성 방법: 배포 서버의 `POST /api/recruit-card/template-art` (X-Admin-Password)
→ 반환된 data URL을 저장해 이 폴더에 커밋. 텍스트 존(좌측 상단 헤드라인,
좌하단 스탯창, 우하단 패널)이 비어 보이도록 프롬프트에 명시할 것.
