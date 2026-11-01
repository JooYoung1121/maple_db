from api.routes.ox_quiz import load_ox, search_ox


def test_dataset_shape():
    doc = load_ox()
    items = doc["items"]
    assert doc["_meta"]["count"] == len(items)
    assert len({it["id"] for it in items}) == len(items)
    for it in items:
        assert it["a"] in ("O", "X")
        assert it["cat"] in ("maple", "general")
        assert it["q"].strip()


def test_search_ignores_spacing_and_needs_all_words():
    hits = search_ox("파란 왕도깨비 돼지고기")
    assert len(hits) == 1 and hits[0]["a"] == "X"
    assert search_ox("왕도깨비 존재하지않는단어") == []
    assert search_ox("   ") == []


def test_parse_ox_query_triggers():
    from api.routes.ox_quiz import parse_ox_query

    assert parse_ox_query("!ox 왕도깨비") == "왕도깨비"
    assert parse_ox_query("OX퀴즈 왕도깨비 정답 뭐야?") == "왕도깨비"
    assert parse_ox_query("ox 족보") == ""
    assert parse_ox_query("oxford 대학") is None
    assert parse_ox_query("왕도깨비 ox") is None


def test_translated_items_keep_set_reference():
    items = load_ox()["items"]
    translated = [it for it in items if it["basis"] == "translated"]
    assert len(translated) > 200
    assert all(it.get("set") for it in translated)
    # 메랜 실제 출제분은 원작 번역 문항과 중복 없이 하나로 합쳐져 있어야 한다
    hits = search_ox("그류핀 얼")
    assert [it["basis"] for it in hits] == ["observed"]


def test_format_reply_marks_translated():
    from api.routes.ox_quiz import format_ox_reply

    assert "(원작 번역문)" in format_ox_reply("로랑 점프", "https://x")
