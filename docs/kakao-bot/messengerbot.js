/**
 * 추억길드 카카오 오픈채팅 봇 — 메신저봇R(API2) 스크립트
 *
 * 동작:
 *  1) 방에서 "!명령" 또는 "푸확아 ~" 메시지를 받으면 서버에 전달하고 응답을 방에 보냄
 *  2) 60초마다 서버 알림 큐(outbox)를 폴링해서 공홈 새 글 알림을 방에 보냄
 *
 * 설치: docs/kakao-bot/README.md 참고
 */

/* ── 설정 (여기만 수정하세요) ─────────────────────────── */
var CONFIG = {
  SERVER: "https://memorymapledb.up.railway.app", // 서버 주소 (끝에 / 없이)
  TOKEN: "여기에_KAKAO_BOT_TOKEN_값",             // Railway에 설정한 KAKAO_BOT_TOKEN과 동일하게
  ROOMS: ["추억길드"],                            // 봇이 반응할 방 이름 (정확히 일치)
  POLL_INTERVAL_MS: 60 * 1000,                    // 알림 폴링 주기 (60초)
};
/* ──────────────────────────────────────────────────── */

var bot = BotManager.getCurrentBot();

function httpJson(method, path, bodyObj) {
  try {
    var conn = org.jsoup.Jsoup.connect(CONFIG.SERVER + path)
      .header("X-Kakao-Bot-Token", CONFIG.TOKEN)
      .header("Content-Type", "application/json")
      .ignoreContentType(true)
      .ignoreHttpErrors(true)
      .timeout(15000);
    if (method === "POST") {
      conn = conn.requestBody(JSON.stringify(bodyObj || {})).method(org.jsoup.Connection.Method.POST);
    } else {
      conn = conn.method(org.jsoup.Connection.Method.GET);
    }
    var res = conn.execute();
    if (res.statusCode() !== 200) {
      Log.d("[bot] HTTP " + res.statusCode() + " " + path);
      return null;
    }
    return JSON.parse(res.body());
  } catch (e) {
    Log.e("[bot] 요청 실패 " + path + ": " + e);
    return null;
  }
}

function isTargetRoom(room) {
  for (var i = 0; i < CONFIG.ROOMS.length; i++) {
    if (CONFIG.ROOMS[i] === room) return true;
  }
  return false;
}

/* ── 1) 메시지 수신 → 서버 → 응답 ── */
bot.addListener(Event.MESSAGE, function (msg) {
  try {
    if (!isTargetRoom(msg.room)) return;
    var text = msg.content.trim();
    // 서버 호출은 명령/호출어일 때만 (일반 대화엔 침묵)
    if (text.indexOf("!") !== 0 && text.indexOf("푸확") !== 0) return;

    var res = httpJson("POST", "/api/kakao-bot/chat", {
      room: msg.room,
      sender: msg.author.name,
      text: text,
    });
    if (res && res.reply) {
      msg.reply(res.reply);
    }
  } catch (e) {
    Log.e("[bot] 메시지 처리 오류: " + e);
  }
});

/* ── 2) 알림 큐 폴링 → 방에 전송 ── */
var pollTimer = null;

function pollOutbox() {
  try {
    var res = httpJson("GET", "/api/kakao-bot/outbox");
    if (!res || !res.messages || res.messages.length === 0) return;
    var acked = [];
    for (var i = 0; i < res.messages.length; i++) {
      var m = res.messages[i];
      var sentAny = false;
      for (var r = 0; r < CONFIG.ROOMS.length; r++) {
        // bot.send는 해당 방의 알림 세션이 있어야 성공 (방 알림 꺼짐/세션 만료 시 false)
        if (bot.send(CONFIG.ROOMS[r], m.message)) sentAny = true;
      }
      if (sentAny) acked.push(m.id);
    }
    if (acked.length > 0) {
      httpJson("POST", "/api/kakao-bot/outbox/ack", { ids: acked });
      Log.d("[bot] 알림 " + acked.length + "건 전송 완료");
    }
  } catch (e) {
    Log.e("[bot] 폴링 오류: " + e);
  }
}

function startPolling() {
  stopPolling();
  pollTimer = new java.util.Timer();
  pollTimer.schedule(
    new JavaAdapter(java.util.TimerTask, { run: pollOutbox }),
    10 * 1000,               // 시작 10초 후 첫 폴링
    CONFIG.POLL_INTERVAL_MS
  );
  Log.i("[bot] 알림 폴링 시작 (" + CONFIG.POLL_INTERVAL_MS / 1000 + "초 주기)");
}

function stopPolling() {
  if (pollTimer !== null) {
    pollTimer.cancel();
    pollTimer = null;
  }
}

// 컴파일/시작 시 타이머 재설정 (중복 타이머 방지)
bot.addListener(Event.START_COMPILE, function () {
  stopPolling();
});

startPolling();
