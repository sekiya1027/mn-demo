/*
 * [DEMO] Lu Ange 店舗HP × メンエスなうウィジェット デモ用モックデータ
 *
 * 本番 widget-embed.js の API 呼び出し (fetch) を丸ごとここで受け、
 * 本番 API (apps/widget/views.py, views_oshikome.py, cta.py) と同じ JSON 形を返す。
 * 出勤ステータスは閲覧時刻から計算するので「リアルタイム」に動く。
 *
 * 各ページは window.MN_DEMO_STORE / window.MN_DEMO_THERAPISTS を先に定義しておくこと (build.py が埋め込む)。
 */
(function () {
  var STORE = window.MN_DEMO_STORE;
  // 1階層配布 (Gist/githack): 全ファイルがページと同じディレクトリにあるので base はそこ
  if (window.MN_DEMO_FLAT) window.MN_DEMO_BASE = location.href.replace(/[?#].*$/, "").replace(/\/[^\/]*$/, "");
  var TS = window.MN_DEMO_THERAPISTS || [];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function parseSched(s) {
    if (!s) return null;
    var m = String(s).match(/(\d{1,2}):(\d{2})\s*[〜~～\-]\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    var st = +m[1] * 60 + +m[2], en = +m[3] * 60 + +m[4];
    if (en <= st) en += 1440;
    return { start: st, end: en };
  }
  function realNow() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  // 出勤中が 2 人未満の時間帯 (深夜・早朝) に開いてもデモが寂しくならないよう 15:30 相当で見せる
  function refMin() {
    var n = realNow();
    var w = TS.filter(function (t) { var s = parseSched(t.sched); return s && n >= s.start && n < s.end; }).length;
    return w >= 2 ? n : 15 * 60 + 30;
  }
  function statusOf(t, ref) {
    var s = parseSched(t.sched);
    if (!s) return { status: null, s: null };
    if (ref < s.start) return { status: "scheduled", s: s };
    if (ref >= s.end) return { status: "finished", s: s };
    return { status: "working", s: s, progress: Math.max(0, Math.min(100, Math.round((ref - s.start) / (s.end - s.start) * 100))) };
  }
  // 出勤中の人に付ける案内バッジ (本番は店舗が管理画面で更新する「今日の案内」)
  function badgeOf(t, st, workingIdx) {
    if (st.status !== "working") return null;
    var k = workingIdx % 4;
    if (t.instant || k === 0) return "now";
    if (k === 1) return "duty";
    if (k === 2) return "next";
    return "full";
  }
  function storeObj() {
    return {
      name: STORE.name, area: STORE.area, logo: null,
      primary_color: STORE.primary_color, accent_color: null, brand_logo_enabled: true
    };
  }
  function findT(puid) { for (var i = 0; i < TS.length; i++) if (TS[i].puid === puid) return TS[i]; return null; }
  function storeCta() {
    return {
      mode: "booking", label: "WEB予約する",
      url: window.MN_DEMO_FLAT ? "/booking.html" : "/widget/book/" + STORE.puid + "/"
    };
  }
  function ctaFor(t) {
    return {
      mode: "booking", label: "WEB予約する",
      url: (window.MN_DEMO_FLAT ? "/booking.html" : "/widget/book/" + STORE.puid + "/") + "?therapist=" + encodeURIComponent(t.puid) + "&name=" + encodeURIComponent(t.name)
    };
  }

  // ── 出勤状況 (data-type="attendance") ──
  function attendance(ref) {
    var items = [], w = 0;
    TS.forEach(function (t) {
      var st = statusOf(t, ref);
      if (!st.status || st.status === "finished") return;
      var badge = badgeOf(t, st, w);
      if (st.status === "working") w++;
      var nextAt = ref + 25 + (hash(t.puid) % 4) * 10;
      items.push({
        name: t.name, image: t.image, age: t.age, height: t.height || null, cup: t.cup || null,
        status: st.status, start_time: fmt(st.s.start), end_time: fmt(st.s.end),
        instant: badge === "now", progress: st.progress != null ? st.progress : null,
        badge: badge || "before",
        next_available: badge === "next" ? fmt(nextAt) : null,
        next_wait_minutes: badge === "next" ? nextAt - ref : null,
        is_full: badge === "full", room_name: t.room || "",  // 多店舗(Finale)は店舗名をルーム名として出す
        catch_copy: badge === "now" ? t.catch || "" : "",
        guide_updated_at: fmt(ref - 12)
      });
    });
    // 本番と同じく出勤中 → 出勤予定の順 (開始時刻順)
    items.sort(function (a, b) {
      var oa = a.status === "working" ? 0 : 1, ob = b.status === "working" ? 0 : 1;
      return oa - ob || a.start_time.localeCompare(b.start_time);
    });
    // 店舗スコープの予約CTA (cta.py _attach_store_cta / allow_store_booking と同形)。
    // 指名なしで予約シートを開き、指名はシート内のセラピスト選択に委ねる
    return { store: storeObj(), guide_updated_at: fmt(ref - 12), items: items, cta: storeCta() };
  }

  // ── 大バナー (data-type="featured") — views.py _build_featured_data と同形 (issue #1166) ──
  // 本番は管理画面で選んだ3人 (中央→左→右)。デモは STORE.featured の puid 順、無ければ名簿先頭3人
  function featured() {
    var picks = (STORE.featured || []).map(findT).filter(Boolean);
    for (var i = 0; i < TS.length && picks.length < 3; i++) if (picks.indexOf(TS[i]) < 0) picks.push(TS[i]);
    var roles = ["main", "left", "right"];
    var items = picks.slice(0, 3).map(function (t, i) {
      return { role: roles[i], name: t.name, image: t.image, age: t.age, height: t.height || null, cup: t.cup || "", is_vip: i === 0 };
    });
    return {
      store: storeObj(), items: items,
      featured: { url: "https://men-esthe.co.jp/", show_cup: true },
      cta: storeCta()
    };
  }

  // ── セラピスト個別タイムライン (data-type="timeline" data-therapist=…) ──
  function headerOf(t, ref) {
    var st = statusOf(t, ref);
    var status = st.status === "working" ? (t.instant ? "available" : "on_duty") : st.status || "finished";
    return {
      name: t.name, image: t.image, status: status,
      schedule_start: st.s ? fmt(st.s.start) : "",
      start_time: st.s ? fmt(st.s.start) : "", end_time: st.s ? fmt(st.s.end) : ""
    };
  }
  function iso(d) { return d.toISOString(); }
  function timeline(puid, offset, ref) {
    var t = findT(puid);
    if (!t) return { store: storeObj(), items: [], has_more: false };
    if (offset > 0) return { store: storeObj(), items: [], has_more: false };
    var st = statusOf(t, ref);
    var today = st.s ? { start: fmt(st.s.start), end: fmt(st.s.end) } : null;
    var now = new Date();
    var imgs = t.images || [];
    var h = hash(t.puid);
    var posts = [
      {
        content: (today ? "本日 " + today.start + "〜" + today.end + " で出勤しています🌸\n" : "") + "まだご案内できるお時間がありますので、お気軽にご連絡ください♪" + (STORE.access_note ? "\n" + STORE.access_note : ""),
        images: imgs.slice(0, 1), at: new Date(now.getTime() - 35 * 60000), likes: 9 + (h % 12), src: null
      },
      {
        content: "先日はご来店ありがとうございました🙏\n今日も丁寧なオイルトリートメントで、お仕事の疲れをしっかり流していきます。\nご予約はこのページの「WEB予約する」からどうぞ✨",
        images: imgs.slice(1, 2), at: new Date(now.getTime() - 26 * 3600000), likes: 15 + (h % 20), src: "x"
      },
      {
        content: "新しいお洋服で待機中です😊\n週末は混み合いますので、お早めのご予約がおすすめです！",
        images: imgs.slice(2, 3), at: new Date(now.getTime() - 3 * 86400000), likes: 21 + (h % 9), src: null
      }
    ];
    var items = posts.map(function (p) {
      return {
        content: p.content, images: p.images, author: t.name, author_image: t.image,
        created_at: iso(p.at), like_count: p.likes, is_store_post: false, store_name: STORE.name,
        area_label: null, today_schedule: today, is_on_duty_now: st.status === "working",
        instant_booking: !!t.instant, source_platform: p.src
      };
    });
    return { store: storeObj(), therapist: headerOf(t, ref), items: items, has_more: false, cta: ctaFor(t) };
  }

  // ── 推しコメ (data-type="oshikome" data-therapist=…) ──
  var TAG_GROUPS = [
    { label: "雰囲気", tags: [["iyashi", "癒やし系"], ["kaiwa", "会話が楽しい"], ["egao", "笑顔がかわいい"], ["otona", "大人の色気"]] },
    { label: "施術", tags: [["teinei", "施術が丁寧"], ["tsuyome", "強めが得意"], ["mitchaku", "密着感"], ["gijutsu", "技術がうまい"]] },
    { label: "スタイル", tags: [["style", "スタイル抜群"], ["kyonyu", "グラマー"], ["slender", "スレンダー"], ["seiketsu", "清潔感"]] },
    { label: "接客", tags: [["kikijozu", "聞き上手"], ["kizukai", "気づかい上手"], ["jikan", "時間きっちり"], ["re_pi", "リピ確定"]] }
  ];
  var REC = [["first", "初めての方"], ["iyashi", "癒やされたい方"], ["kaiwa", "会話を楽しみたい方"], ["tsuyome", "しっかり揉まれたい方"]];
  var COMMENTS = [
    { c: "{name}さんは本当に聞き上手で、気づいたら仕事の愚痴まで話してました。施術も丁寧で肩がすごく軽くなりました。また伺います！", tags: ["聞き上手", "施術が丁寧", "癒やし系"], rec: "初めての方", d: "3日前", a: "常連のKさん", g: false },
    { c: "初めてのメンエスで緊張していましたが、{name}さんの笑顔と会話で一気にリラックスできました。強さの加減も聞いてくれて安心です。", tags: ["笑顔がかわいい", "会話が楽しい", "気づかい上手"], rec: "初めての方", d: "1週間前", a: "匿名", g: true },
    { c: "{area}でここまで密着感のある施術は貴重。時間もきっちり守ってくれて、終わった後の爽快感がすごい。リピ確定です。", tags: ["密着感", "時間きっちり", "リピ確定"], rec: "しっかり揉まれたい方", d: "2週間前", a: "T.M", g: false },
    { c: "写真どおりスタイル抜群で清潔感もあり、お部屋の雰囲気も落ち着いていました。会話のテンポが心地よくて、あっという間の90分でした。", tags: ["スタイル抜群", "清潔感", "会話が楽しい"], rec: "癒やされたい方", d: "3週間前", a: "匿名", g: true },
    { c: "大人の余裕があって包容力がすごいです。{name}さんの施術は眠ってしまうほど気持ちよかった。次は120分でお願いしたい。", tags: ["大人の色気", "癒やし系", "技術がうまい"], rec: "癒やされたい方", d: "1ヶ月前", a: "Y", g: false }
  ];
  function oshikome(puid, count) {
    var t = findT(puid);
    if (!t) return { store: { name: STORE.name, logo: null, brand_logo_enabled: true }, therapist: null, total: 0, summary: null, items: [], has_more: false };
    var h = hash(t.puid);
    var total = 6 + (h % 9);
    var rot = h % COMMENTS.length;
    var all = COMMENTS.slice(rot).concat(COMMENTS.slice(0, rot)).map(function (x) {
      return { author: x.a, is_guest: x.g, date_label: x.d, comment: x.c.replace(/\{name\}/g, t.name).replace(/\{area\}/g, STORE.area), tags: x.tags, recommended_for: x.rec };
    });
    var lim = count === "all" ? all.length : (+count || 3);
    var tally = {};
    all.forEach(function (r) { r.tags.forEach(function (g) { tally[g] = (tally[g] || 0) + 1; }); });
    var ranked = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a] || a.localeCompare(b); });
    var mk = function (g, i) { return { label: g, count: tally[g] + (i === 0 ? 2 : 0) + (h % 3) }; };
    return {
      store: { name: STORE.name, logo: null, brand_logo_enabled: true },
      therapist: { name: t.name, image: t.image },
      total: total,
      summary: {
        title: ranked[0] + "で " + ranked[1],
        headline: ranked.slice(0, 2),
        podium: ranked.slice(0, 3).map(mk),
        extra_chips: ranked.slice(3, 6).map(mk),
        area_rank: 1 + (h % 3), area_name: STORE.area
      },
      items: all.slice(0, lim),
      has_more: lim < all.length,
      form: {
        turnstile_site_key: "", comment_min_length: 20,
        tag_groups: TAG_GROUPS.map(function (g) { return { label: g.label, tags: g.tags.map(function (x) { return { slug: x[0], label: x[1] }; }) }; }),
        recommended_for: REC.map(function (x) { return { value: x[0], label: x[1] }; })
      },
      cta: ctaFor(t)
    };
  }
  function roster() {
    return { therapists: TS.map(function (t) { return { puid: t.puid, name: t.name, bookable: true }; }) };
  }

  function query(u) {
    var q = {}, i = u.indexOf("?");
    if (i === -1) return q;
    u.slice(i + 1).split("&").forEach(function (kv) {
      var p = kv.split("="); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });
    return q;
  }
  function ok(data) {
    return new Promise(function (res) {
      // 実通信っぽい間 (スケルトン表示の確認用)
      setTimeout(function () { res({ ok: true, status: 200, json: function () { return Promise.resolve(data); } }); }, 220);
    });
  }

  window.MN_DEMO_FETCH = function (url, opts) {
    var u = String(url), method = (opts && opts.method) || "GET";
    if (method !== "GET") return ok({ ok: true, pending: true });
    var q = query(u), ref = refMin();
    if (/\/widget\/api\/oshikome\//.test(u)) {
      if (q.therapists) return ok(roster());
      return ok(oshikome(q.therapist, q.count));
    }
    if (/\/widget\/api\/shop\//.test(u)) {
      if (q.type === "attendance") return ok(attendance(ref));
      if (q.type === "timeline") return ok(timeline(q.therapist, +q.offset || 0, ref));
      if (q.type === "featured") return ok(featured());
    }
    return window.fetch(url, opts);
  };
})();
