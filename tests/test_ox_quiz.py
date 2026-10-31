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
