/**
 * メンエスなう 埋め込みウィジェット (Shadow DOM + API)
 *
 * <script src="https://men-esthe.co.jp/static/js/widget-embed.js"
 *         data-store="STORE_PUID"
 *         data-type="attendance"
 *         data-theme="dark"></script>
 *
 * 店舗グループ (系列店合同タイムライン)。?v=N は旧キャッシュ回避のバージョンクエリ:
 * <script src="https://men-esthe.co.jp/static/js/widget-embed.js?v=3"
 *         data-group="GROUP_PUID"
 *         data-theme="dark"></script>
 *
 * PC 向けレイアウト属性 (いずれも任意。未指定なら従来どおりの表示):
 *   data-columns="2" | "3"  タイムラインを複数カラムにする (timeline 専用)。
 *                           カードは高さに合わせて隙間なく詰める (Pinterest 風)
 *   data-height="300" | "auto"  スクロール領域の max-height を上書き ("auto" は内部
 *                               スクロールなしで 1 リクエスト分を全件展開)
 *   data-compact="true"     タイムラインをアバター 28px・本文 2 行・余白狭めに圧縮
 *   data-touch-lock="true"  スマホ (粗いポインタ) ではタップするまで枠内スクロールを止め、
 *                           ページのスクロールを妨げない (issue #1400。?v=13 以降)。
 *                           枠内に閉じたスクロールを持たない設置 (data-height="auto" /
 *                           featured / oshikome) と PC では何もしない。
 *                           iframe 版では親ページのタッチが届かないため、再ロックは
 *                           ウィジェットが画面外へ出たときだけ (script 版は枠外タッチでも戻る)
 *
 * data-type="featured" は店舗公式サイトTOP用の大バナー (issue #1166。?v=8 以降必須):
 * セラピストカルーセル3枚 + 店舗ブロックの横長1枚で、全面が店舗ページへのリンク。
 * 出すセラピストは管理画面で選んで DB 保存するためタグ側に追加属性は無い。
 * 表示比率だけはタグで選ぶ (issue #1286。?v=11 以降。既定の横長では属性を出さない):
 *   data-ratio="4:3"  正方形に近い設置枠向け。左: 縦カード / 右: 店舗ブロックの2列で 4:3 に組む
 *                     (比率は厳密。枠は中身に合わせて伸びない)。枠幅 480px 未満では右列の字が
 *                     読めなくなるので従来の縦積み (自然な高さ) に戻る
 *
 * data-type="oshikome" は推しコメウィジェット (issue #1235。?v=9 以降必須):
 * 承認済み推しコメの閲覧 + ウィジェット内からのゲスト投稿 (審査後に公開)。
 * data-therapist があればそのセラピスト宛て、無ければ店舗単位 (issue #1282。?v=12 以降必須)。
 * 店舗単位ではカードに宛先セラピスト名が出て、投稿フォームで宛先を選ばせる。
 * 専用オプション (既定値のときは属性を出さない):
 *   data-count="3" | "5" | "all"  表示件数 (既定 all。?v=16 で 3 → all に変更。issue #1551)。
 *                                 all は 30 件ずつ取得し、一覧の枠内スクロール末尾で続きを足す
 *   data-post="false"             投稿受付 OFF = 閲覧専用
 *   data-summary="false"          推しポイントまとめ (称号・表彰台) を出さない
 *
 * 設置先が他ドメインの script 版では、投稿フォームだけはポータルのページ
 * (/widget/embed/ の単体モード = data-compose) を iframe で重ねて開く (issue #1485。?v=15 以降)。
 * Turnstile が設置先ドメインでは通らないため。閲覧は従来どおりこのページに描く
 *
 * data-fill="true" は iframe 版ラッパー (/widget/embed/) 専用 (?v=10 以降):
 * 中身を枠いっぱいに伸ばす。iframe は高さを決め打ちで確保するため、中身が薄い店だと
 * 枠の下半分が空いて設置先のレイアウトに穴が空くのを防ぐ。ラッパー (html/body が
 * height:100%) の中でしか意味を持たず、通常の script タグ設置では付かない
 *
 * セラピスト指定のタイムラインで投稿が0件のときは、API が返す profile (写真・今週の出勤・
 * 紹介文・推しコメ) を空表示の代わりに描く (issue #1641。?v=17 以降)
 *
 * 出勤状況 (attendance) は今日の案内を描く (issue #1731。?v=18 以降): 最短ご案内・本日満了・
 * 受付終了のバッジ (判定は API の badge)、ルーム名、一言、ヘッダーの「案内状況 HH:MM 更新」。
 * data-therapist 付きならその 1 人分のカード (退勤後は「受付終了」で残す)
 *
 * data-store / data-group の無い <script src=".../widget-embed.js"></script> は描画せず、
 * 同じページの iframe 版の枠の高さを中身に追従させるだけの受信役になる (issue #1531)。
 * nl2br する CMS は高さ調整スニペット (中身のある <script>) を改行で壊し、iframe の
 * data 属性も消すが、中身も属性も無いこのタグは残るため。iframe 版 (fill=1) が
 * 中身の高さを通知するのは ?v=19 のラッパーから
 */
(function () {
  // [DEMO] モックデータ用フック: window.MN_DEMO_FETCH があれば API 呼び出しをそれに流す (本番 JS との差分はこの 1 行だけ)
  var fetch = window.MN_DEMO_FETCH || window.fetch.bind(window);
  var script = document.currentScript;
  if (!script) return;

  // iframe 版の高さ自動調整の受信側 (issue #1531)。プロトコルは widgetEmbedTools.js の
  // buildResizeSnippet / _bindPreviewResize と同じで、変えるときは 3 か所とも直すこと。
  // data-mn-widget は CMS に落とされることがあるので src でも拾う。送信元は配信元の
  // origin と「その iframe の contentWindow」の両方で確かめ、他オリジンからの message で
  // 関係ない iframe の高さを変えない
  function bindFrameResize(origin) {
    // 配布タグは iframe ごとに script が付くので、1 ページに何本あっても受信は 1 回にする
    if (window.__mnWidgetFrameResize) return;
    window.__mnWidgetFrameResize = true;
    // script と iframe の片方だけ www 付き・http で書かれていても受けられるよう、
    // https に寄せて www. を外した形で比べる (iframe は正規のオリジンへリダイレクトされる)
    var normOrigin = function (u) {
      return String(u).replace(/^http:/, "https:").replace(/^(https:\/\/)www\./, "$1");
    };
    var base = normOrigin(origin);
    var frameSelector = 'iframe[data-mn-widget], iframe[src*="/widget/embed/"]';
    // src だけで拾った iframe は配信元のラッパーに限る。設置先の第三者の iframe が
    // 配信元の embed に遷移して高さを書き換えるのを防ぐ
    var isWidgetFrame = function (f) {
      return f.hasAttribute("data-mn-widget") || normOrigin(f.src).indexOf(base + "/widget/embed/") === 0;
    };
    // 属性を剥がされた script 版の設置で、無言で何も出ない状態の手がかりを残す
    var warnIfNoFrame = function () {
      var frames = document.querySelectorAll(frameSelector);
      for (var i = 0; i < frames.length; i++) if (isWidgetFrame(frames[i])) return;
      console.warn("[MN] data-store / data-group 属性が無いため描画しません。高さを調整するウィジェットの iframe も見つかりません");
    };
    if (document.readyState === "complete") warnIfNoFrame();
    else window.addEventListener("load", warnIfNoFrame);
    window.addEventListener("message", function (e) {
      if (normOrigin(e.origin) !== base) return;
      var d = e.data;
      if (!d || d.type !== "mn-widget") return;
      var frames = document.querySelectorAll(frameSelector);
      for (var i = 0; i < frames.length; i++) {
        var f = frames[i];
        if (f.contentWindow !== e.source || !isWidgetFrame(f)) continue;
        if (d.event === "resize" && !f.hasAttribute("data-mn-overlay")) {
          var h = Number(d.height);
          // 0 も受ける (退店・閉店で中身が消えたときに枠ごと畳む)
          if (isFinite(h) && h >= 0) f.style.height = Math.min(h, 5000) + "px";
        } else if (d.event === "overlay-open" && !f.hasAttribute("data-mn-overlay")) {
          f.setAttribute("data-mn-overlay", f.style.height || "");
          f.style.height = Math.min(window.innerHeight, 5000) + "px";
          f.scrollIntoView({ block: "start" });
        } else if (d.event === "overlay-close" && f.hasAttribute("data-mn-overlay")) {
          f.style.height = f.getAttribute("data-mn-overlay");
          f.removeAttribute("data-mn-overlay");
        }
        return;
      }
    });
  }

  var storePuid = script.getAttribute("data-store");
  var groupPuid = script.getAttribute("data-group") || "";
  if (!storePuid && !groupPuid) {
    bindFrameResize(script.src.replace(/\/static\/js\/widget-embed\.js.*$/, ""));
    return;
  }

  var therapistPuid = script.getAttribute("data-therapist") || "";
  var type = script.getAttribute("data-type") || "attendance";
  var theme = script.getAttribute("data-theme") || "dark";

  // グループ指定時は timeline 固定 (両方指定された場合は data-group を優先)
  if (groupPuid) {
    type = "timeline";
    therapistPuid = "";
  }

  // PC 向けレイアウト属性。未指定/不正値は 0 や "" に落として従来表示のままにする
  // (既存の設置済みタグを一切変えないための後方互換ガード)
  var columnsAttr = script.getAttribute("data-columns") || "";
  // 複数カラムはタイムライン専用。staff/media の自動カラム分割グリッドには手を出さない
  var columns = (type === "timeline" && (columnsAttr === "2" || columnsAttr === "3")) ? Number(columnsAttr) : 0;

  var heightAttr = script.getAttribute("data-height") || "";
  var heightMode = "";  // "" = 従来の CSS 固定値 / "auto" = 全件展開 / "px" = 指定 px
  var heightPx = 0;
  if (heightAttr === "auto") {
    heightMode = "auto";
  } else if (/^\d{2,4}$/.test(heightAttr)) {
    var hp = parseInt(heightAttr, 10);
    if (hp >= 120 && hp <= 5000) { heightMode = "px"; heightPx = hp; }
  }

  var compact = script.getAttribute("data-compact") === "true";

  // スマホのタップ解除 (issue #1400)。属性の無い既存設置は一切変わらない
  var touchLock = script.getAttribute("data-touch-lock") === "true";

  // iframe 版ラッパー (/widget/embed/) 専用。高さ自動調整スニペットを使わない設置では
  // iframe の高さが決め打ちになるため、中身が薄い店で枠の下半分が空く。
  // 中身を枠いっぱいに伸ばして「意図した固定パネル」に見せる。
  // ラッパーだけが付ける属性なので、既存の script タグの表示は一切変わらない
  var fill = script.getAttribute("data-fill") === "true";

  // 推しコメウィジェット専用オプション (issue #1235)。既定値タグには属性が付かない
  // 件数の既定は全件 (issue #1551)。3件/5件は明示指定のときだけ
  var okCountAttr = script.getAttribute("data-count") || "";
  var okCount = (okCountAttr === "3" || okCountAttr === "5") ? okCountAttr : "all";
  var okPost = script.getAttribute("data-post") !== "false";
  var okSummary = script.getAttribute("data-summary") !== "false";
  // 投稿フォーム単体モード (issue #1485)。iframe 版ラッパー専用で、下の okRemoteForm が
  // オーバーレイに開くページだけが付ける。一覧を飛ばして最初からフォームを開き、
  // 閉じる操作は親ページへの通知になる。data-compose-to は宛先の初期選択 (店舗単位)
  var okCompose = script.getAttribute("data-compose") === "true";
  // iframe で開けなかったときの受け皿として、同じページを新しいタブで直接開くこともある。
  // その場合は通知する親もオーバーレイの × も無いので、通常のフォームとして振る舞う
  var okComposeFramed = okCompose && window.parent !== window;
  var okComposeTo = script.getAttribute("data-compose-to") || "";
  // data-therapist が無ければ店舗単位 (issue #1282)。投稿の宛先はフォームで選ばせる
  var okStoreScope = type === "oshikome" && !therapistPuid;

  // 大バナーの表示比率 (issue #1286)。"4:3" 以外 (未指定含む) は横長
  var ftRatio = (type === "featured" && script.getAttribute("data-ratio") === "4:3") ? "4:3" : "";

  // 管理画面プレビュー/デモ専用フラグ。予約CTA が OFF でも「ON にすると出るもの」を
  // 描かせる (許可判定はサーバ側。設置先タグにこの属性は付けない)
  var preview = script.getAttribute("data-preview") === "true";

  // 設置先で「なぜカラムが畳まれたか」を店舗が自力で確認するためのフラグ。
  // ホストページの URL に付けてもらう (?mnwidget=debug / #mnwidget-debug)。
  // 管理画面プレビューは枠が実際の設置先より広いことがあり、そちらでは幅不足を再現できない
  // 案内は「URL の末尾に付ける」なので、ハッシュを持つページでは
  // ?foo#bar?mnwidget=debug のような並びになる。search と hash を繋いで見る
  var debugMode = /[?&#]mnwidget=debug(?:[&#]|$)/.test(location.search + location.hash)
    || /(?:^|[?&#])mnwidget-debug(?:[&#]|$)/.test(location.hash);

  // [DEMO] 1階層配布 (Gist) では demo-data.js が MN_DEMO_BASE (ページのディレクトリ) を渡す
  var base = window.MN_DEMO_BASE || script.src.replace(/\/static\/js\/widget-embed\.js.*$/, "");
  var brandDir = window.MN_DEMO_BASE ? "/" : "/static/img/common/";

  // 設置先が他ドメインの script 版では、推しコメの投稿フォームをこのページに描かず
  // ポータル側のページを iframe で開く (issue #1485)。Turnstile は描画したページの
  // ホスト名を site key の許可リストと照合するため、店舗ドメインでは必ず 110200 で
  // 失敗する (許可リストは 10 件までで店舗数ぶん登録できない)。予約フォームと同じく
  // iframe の中ならホスト名はポータル自身になる
  var okRemoteForm = location.origin !== base;
  // 単体モードの起動通知 (compose-ready) はラッパー (embed.html) が HTML の到着時点で送る。
  // これが届かなければ iframe を開けなかったと判断し、リンクに切り替える
  var OK_COMPOSE_READY_TIMEOUT = 6000;

  // タイムラインのページング状態 (内部無限スクロール)
  // data-height="auto" は内部スクロールが無く追加ロードできないため 1 リクエストで多めに取る
  var pageSize = heightMode === "auto" ? 30 : 10;
  var currentOffset = 0;
  var hasMore = false;
  var isLoading = false;
  var accent = null;
  var bodyEl = null;
  var imgObserver = null;

  function buildApiUrl(offset) {
    if (groupPuid) {
      // type はグループ指定時に "timeline" へ正規化済み (固定ロジックの二重定義を避け変数を参照)
      return base + "/widget/api/group/" + encodeURIComponent(groupPuid)
        + "/?type=" + encodeURIComponent(type) + "&limit=" + pageSize + "&offset=" + offset;
    }
    if (type === "oshikome") {
      // pick=1 は「この API の cta を扱える」という申告 (サーバ側 _oshikome_get 参照)。
      // preview は予約CTA が入った時点 (#1304) から必要になった。付けないと
      // 管理画面プレビューの表示が実績に混ざり、設定 OFF の店はデモ表示も見られない。
      // 未公開の自店を開けるかは別で、cookie の認証 (_get_viewable_store) が決める
      return base + "/widget/api/oshikome/" + encodeURIComponent(storePuid)
        + "/?count=" + okCount
        + (therapistPuid ? "&therapist=" + encodeURIComponent(therapistPuid) : "")
        // 単体モードはフォームしか描かない。pick=1 を付けると開くたびに予約CTA の
        // 表示回数が 1 件余分に記録される (サーバ側 record_impression) ので外し、
        // 使わない推しポイントまとめの集計も止める
        + (okCompose ? "" : "&pick=1")
        + (preview ? "&preview=1" : "")
        + (okSummary && !okCompose ? "" : "&summary=0") + (okPost ? "" : "&post=0");
    }
    var u = base + "/widget/api/shop/" + encodeURIComponent(storePuid) + "/?type=" + encodeURIComponent(type);
    if (therapistPuid) {
      u += "&therapist=" + encodeURIComponent(therapistPuid);
    } else {
      // cta=1 は「店舗スコープ (宛先未定) の cta を扱える」という申告 (サーバ側 _attach_store_cta 参照)。
      // widget-embed.js は 5 分キャッシュなので、その窓に居る旧 JS には CTA を返させない
      u += "&cta=1";
    }
    if (preview) u += "&preview=1";
    if (type === "timeline") u += "&limit=" + pageSize + "&offset=" + offset;
    return u;
  }

  // inline style に連結する前にカラーコード形式を検証 (#RGB / #RRGGBB のみ許可)。
  // DB に不正値が混入しても CSS インジェクションを防ぐ
  function safeColor(c, fallback) {
    return (typeof c === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) ? c : fallback;
  }

  // safeColor 済みのカラーコードに不透明度を足して #RRGGBBAA にする。
  // #RGB 表記のままアルファを足すと 5 桁の不正値になるので 6 桁へ展開してから付ける
  function withAlpha(hex, alpha) {
    var h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return "#" + h + alpha;
  }

  // src 属性の javascript: / data: スキーム弾き (DB に不正 URL が混入した場合の保険)
  function safeUrl(u) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    // ルート相対 (/static/... のデフォルト画像や dev の /media/...) は埋め込み元
    // オリジンではなく配信元 (base = men-esthe.co.jp) に対して解決する
    if (u.charAt(0) === "/") return base + u;
    return "";
  }

  // data-columns 未指定のタイムラインに掛ける上限幅。診断バーの文言でも参照するので、
  // 数字を2か所に散らさないよう定数にしておく
  var TL_MAX_WIDTH = 550;

  // コンテナ + Shadow DOM
  var host = document.createElement("div");
  // タイムラインは1カラム表示のため、広い親要素に置かれても横に間延びしないよう上限幅を設ける。
  // 複数カラム指定時は PC 幅をフルに使うのが目的なので上限を外す
  // position:relative は設置先対策。祖先が static のままだと、設置先が body 直下に敷いている
  // position:fixed の背景レイヤー (vegas 等のスライドショー) より下に描画され、レイアウト上は
  // 場所を取っているのに画面には何も見えない状態になる。z-index は付けない
  // (設置先の固定ヘッダー等を追い越さないよう、位置指定だけで DOM 順の解決に委ねる)
  // oshikome も単カラム縦積みなので timeline と同じ上限幅を共有する (値の出どころは TL_MAX_WIDTH)
  host.style.cssText = "display:block;position:relative;width:100%;"
    + ((type === "timeline" && !columns) || type === "oshikome" ? "max-width:" + TL_MAX_WIDTH + "px;" : "")
    // fill は html/body も 100% にしたラッパー内でだけ立つ (パーセント高さの連鎖)
    + (fill ? "height:100%;" : "");
  // プレビュー画面で設定を素早く切り替えると、読み込み完了前に script が
  // コンテナごと差し替えられて parentNode が null になることがある
  if (!script.parentNode) return;
  script.parentNode.insertBefore(host, script);
  var shadow = host.attachShadow({ mode: "closed" });

  var dark = theme !== "light";
  var colors = dark
    ? { bg:"#0b0e14", card:"#161b26", el:"#1e2433", bdr:"rgba(255,255,255,0.07)", bdrS:"rgba(255,255,255,0.12)", txt:"#f5f6f8", sub:"#a0a6b0", mut:"#6b7280", fnt:"#4b5563" }
    : { bg:"#f8f9fb", card:"#ffffff", el:"#f1f3f6", bdr:"rgba(0,0,0,0.06)", bdrS:"rgba(0,0,0,0.1)", txt:"#111827", sub:"#4b5563", mut:"#9ca3af", fnt:"#d1d5db" };

  // 新しいタブで直接開いた単体モード (iframe を開けない設置先の受け皿)。ラッパーの
  // body は透明・左寄せなので、そのままだと白いページの左端にフォームが浮く
  if (okCompose && !okComposeFramed) {
    document.body.style.background = colors.bg;
    host.style.margin = "0 auto";
  }

  // 設置先から継承で漏れてくるプロパティを shadow 内部で一括初期化する定義。
  // shadow は「セレクタで狙われること」は防ぐが継承は素通しで、しかも :host の宣言は
  // 外側ページの規則に必ず負ける (font-family を :host に書いても効かない)。
  // 外側から触れない内部要素に all:initial を当てることで、文字組みだけでなく
  // user-select (コピー禁止 CSS) や pointer-events まで含めて列挙漏れなく断つ。
  // all は attachShadow より広くサポートされているのでフォールバックは不要。
  // - direction / unicode-bidi は仕様上 all の対象外なので個別に戻す
  // - text-size-adjust は initial (auto) だと iOS が文字を勝手に拡大するので 100% にする
  // - color-scheme はテーマに合わせる。initial (normal) のままだと暗色テーマでも
  //   スクロールバー等のネイティブ UI が明色で描画されるので、RESET 側に持たせて
  //   ウィジェット本体と予約オーバーレイの両方に必ず乗るようにする
  var RESET = "all:initial;direction:ltr;unicode-bidi:normal;"
    + "color-scheme:" + (dark ? "dark" : "light") + ";"
    + "-webkit-text-size-adjust:100%;text-size-adjust:100%;box-sizing:border-box;"
    + "font-family:-apple-system,BlinkMacSystemFont,'Noto Sans JP','Hiragino Sans',sans-serif;"
    + "font-size:14px;line-height:1.5;";

  // スタイル
  var style = document.createElement("style");
  style.textContent = [
    /* :host の宣言は外側ページの規則に必ず負けるので何も置かない。
       ホスト要素の防御は inline style 側、中身の防御は .root の RESET が担う */
    "*{box-sizing:border-box;margin:0;padding:0}",
    /* ルート自体をスクロール容器にして、ヘッダーも中身と一緒に流れるようにする */
    ".root{" + RESET + "display:block;color:" + colors.txt +
      ";background:" + colors.bg + ";border-radius:16px;overflow-x:hidden;overflow-y:auto;max-height:470px;overscroll-behavior:contain;border:1px solid " + colors.bdrS + "}",
    ".root.tl{max-height:570px}",
    ".root::-webkit-scrollbar{display:none}",
    /* ---- 幅の診断バー (管理画面プレビュー / デバッグ URL のときだけ描く) ----
       .root はスクロール容器なので中に入れると流れて隠れる。外に並べるぶん
       設置先からの継承を .root の RESET に頼れないので、ここでも RESET を効かせる */
    ".diag{" + RESET + "display:block;margin-top:6px;padding:7px 10px;border-radius:10px;background:" + colors.el
      + ";border:1px solid " + colors.bdrS + ";color:" + colors.sub + ";font-size:11px;line-height:1.6}",
    ".diag b{font-weight:800;color:" + colors.txt + "}",
    /* 幅が足りず畳まれている状態だけ色を変える (満たしているときは静かに数字だけ出す)。
       ライトの明るい地に橙 500 を置くとコントラストが 2.5:1 まで落ちて、いちばん読ませたい
       数字がいちばん読めなくなるので、明側は暗いアンバーに振る (どちらも AA を満たす) */
    ".diag.ng b{color:" + (dark ? "#f97316" : "#b45309") + "}",
    ".diag-hint{margin-top:1px}",
    /* 運営がスクショから読込元を判別するための行。店舗向けではないので一段落とす。
       文字を薄くすると 10px では判読できなくなるため、弱めるのは字送りだけにする */
    ".diag-src{margin-top:3px;font-size:10px;word-break:break-all}",
    ".code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-feature-settings:'tnum','zero'}",
    /* ヘッダー: メンエスなうロゴのみを中央に配置（固定せず中身と一緒にスクロール） */
    ".hdr{display:flex;align-items:center;justify-content:center;padding:12px 16px;border-bottom:1px solid " + colors.bdr + "}",
    ".hdr-brand{height:24px;width:auto;display:block}",
    /* セラピストヘッダー: 誰のタイムラインかを示す (ロゴ直下・中身と一緒にスクロール) */
    ".thdr{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid " + colors.bdr + "}",
    ".thdr-av{width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center 20%;border:2px solid " + colors.bdr + ";flex-shrink:0;display:block}",
    ".thdr-ph{width:38px;height:38px;border-radius:50%;background:" + colors.el + ";display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:900;color:" + colors.sub + "}",
    ".thdr-main{flex:1;min-width:0}",
    ".thdr-name{font-size:14px;font-weight:800;color:" + colors.txt + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".thdr-sub{display:flex;align-items:center;gap:5px;margin-top:2px;font-size:10.5px;color:" + colors.sub + "}",
    ".thdr-sub svg{width:10px;height:10px;flex-shrink:0;opacity:.65}",
    /* スタッフカード用バッジを流用するが、ヘッダーでは行内に置く */
    ".thdr .staff-badge{position:static;flex-shrink:0}",
    /* 予約CTA: スクロール容器 (.root) の末尾に sticky で置き、右端に浮かせる。
       設置先は他社の公式サイトなので、下部を丸ごと占有する帯にはしない。

       - 幅を内容ぶんに留めて右寄せ。左側は投稿が最後まで読めるので、
         全幅の帯より 1 件ぶん多く見えたまま常時予約導線を出せる
       - 面はカード色の半透明 + backdrop-blur。背後の投稿がぼけて透けるので
         「上に貼った板」ではなく同じ面の一部に見える
       - 店舗カラーはアイコンと矢印の差し色だけ。面を店舗カラーで塗らないので、
         どんなブランドカラーでも設置先から浮かず、ラベルも必ず読める
       - 負のマージンで持ち上げないこと。sticky を素直に流れに置くことで、
         最下部までスクロールしたときにピルが最後の投稿の下に収まり、
         本文が永久に隠れるフローティングボタン特有の事故を防ぐ */
    ".cta{position:sticky;bottom:0;z-index:5;display:flex;flex-direction:column;align-items:flex-end;gap:5px;padding:8px 12px 12px;pointer-events:none}",
    ".cta-btn{pointer-events:auto;display:inline-flex;align-items:center;gap:7px;border:1px solid " + colors.bdrS +
      ";border-radius:999px;padding:11px 14px 11px 13px;font:inherit;font-size:13px;font-weight:700;letter-spacing:.01em;color:" +
      colors.txt + ";background:" + withAlpha(colors.card, dark ? "c7" : "d9") +
      ";backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);text-decoration:none;cursor:pointer;transition:transform .12s;box-shadow:inset 0 1px 0 " +
      (dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,1)") + ",0 10px 28px -10px " +
      (dark ? "rgba(0,0,0,.95)" : "rgba(0,0,0,.28)") + "}",
    ".cta-btn:hover{transform:translateY(-1px)}",
    ".cta-btn:active{transform:translateY(0)}",
    ".cta-ico{display:flex;flex-shrink:0}",
    ".cta-arrow{display:flex;flex-shrink:0;opacity:.7;margin-right:-2px}",
    ".cta-btn svg{width:14px;height:14px}",
    /* タップ解除のピル (data-touch-lock)。.root の中に置くとスクロール位置に連れて動くうえ
       末尾の sticky は .cta と同じ位置で重なるので、host (position:relative) 基準の絶対配置で
       .root の下端中央に浮かせる。.root の外なので設置先からの継承は RESET で断つ。
       下端の位置は予約CTA の実測高さで決めるので inline で上書きする (syncPill) */
    /* 帯は素通し、ピル本体だけ受ける。素通しにすると「タップしてスクロール」を狙った指が
       下の「さらに表示」や予約ボタンに抜けて、案内と違うことが起きる */
    ".tlock{" + RESET + "display:none;position:absolute;left:0;right:0;bottom:12px;z-index:6;justify-content:center;pointer-events:none}",
    ".tlock-btn{pointer-events:auto;cursor:pointer}",
    ".tlock-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid " + colors.bdrS +
      ";border-radius:999px;padding:8px 14px 8px 12px;font-size:12px;font-weight:700;color:" + colors.txt +
      ";background:" + withAlpha(colors.card, dark ? "c7" : "d9") +
      ";backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);box-shadow:0 10px 28px -10px " +
      (dark ? "rgba(0,0,0,.95)" : "rgba(0,0,0,.28)") + "}",
    ".tlock-btn svg{width:14px;height:14px;flex-shrink:0}",
    /* 受付時間の注記も投稿の上に重なるので、読めるよう同じ半透明の面を敷く */
    ".cta-hint{font-size:10px;color:" + colors.mut + ";background:" + withAlpha(colors.bg, dark ? "c7" : "d9") +
      ";backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:2px 8px;border-radius:8px}",
    /* デモ表示 (管理画面プレビュー限定)。設置先には出ない状態だと分かるよう
       注記と同じ面に破線を足す。ボタン自体の見た目は本番と変えない */
    ".cta-demo{font-size:10px;font-weight:700;color:" + colors.mut + ";background:" + withAlpha(colors.bg, dark ? "c7" : "d9") +
      ";backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:2px 8px;border-radius:8px;border:1px dashed " + colors.bdrS + "}",
    "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}",
    "@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}",
    /* コンテンツ */
    ".body{padding:10px 12px}",
    ".body.tl{padding:0}",
    ".tl-loader{padding:16px 0;display:flex;align-items:center;justify-content:center}",
    ".tl-end{padding:28px 0 24px;display:flex;flex-direction:column;align-items:center;gap:8px;color:" + colors.mut + "}",
    ".tl-end-icon{width:32px;height:32px;border-radius:50%;border:1.5px solid currentColor;opacity:.5;display:flex;align-items:center;justify-content:center}",
    ".tl-end-text{font-size:12px;opacity:.7;letter-spacing:.02em}",
    ".empty{padding:48px 0;text-align:center;font-size:12px;color:" + colors.mut + "}",
    /* fill でセラピスト指定のタイムラインが空表示しか無いときは枠の縦中央に置く (上に詰めると下が空箱になる。issue #1641) */
    ".root.fill-empty{display:flex;flex-direction:column}",
    ".root.fill-empty>.body{flex:1 0 auto;display:flex;flex-direction:column;justify-content:center}",
    /* 出勤カード */
    ".att-card{position:relative;display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:16px;background:" + colors.card + ";border:1px solid " + colors.bdr + ";margin-bottom:7px;overflow:hidden;animation:fadeUp .45s cubic-bezier(.2,.7,.2,1) both}",
    ".att-edge{position:absolute;left:0;top:0;bottom:0;width:3px}",
    ".att-av{position:relative;flex-shrink:0}",
    ".att-img{width:52px;height:52px;border-radius:13px;object-fit:cover;object-position:center 18%;border:1px solid " + colors.bdrS + ";display:block}",
    ".att-ph{width:52px;height:52px;border-radius:13px;background:" + colors.el + ";display:flex;align-items:center;justify-content:center}",
    ".att-pulse{position:absolute;bottom:-3px;right:-3px;width:15px;height:15px;border-radius:50%;background:" + colors.card + ";display:flex}",
    ".att-pulse::before{content:'';position:absolute;inset:2.5px;border-radius:50%;background:#34d399;box-shadow:0 0 0 2px " + colors.card + ";animation:pulse 1.8s ease-in-out infinite}",
    ".att-main{flex:1;min-width:0}",
    // ルーム名は名前の横に収まらなければ次の行へ回す (issue #2007)。名前と年齢は .att-who で 1 塊にして、
    // 長い名前でも年齢だけが次の行へ落ちず、従来どおり名前を省略する
    ".att-row1{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 16px;min-width:0;overflow:hidden}",
    ".att-who{flex:0 1 auto;display:flex;align-items:baseline;gap:6px;min-width:0}",
    ".att-name{flex:0 1 auto;font-size:13.5px;font-weight:800;color:" + colors.txt + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".att-age{font-size:10px;font-weight:700;color:" + colors.mut + ";flex-shrink:0}",
    ".att-row2{display:flex;align-items:center;gap:5px;margin-top:3px;font-size:10.5px;color:" + colors.sub + ";white-space:nowrap;overflow:hidden}",
    ".att-row2 svg{width:10px;height:10px;flex-shrink:0;opacity:.65}",
    ".att-time{font-weight:700;color:" + colors.txt + ";flex-shrink:0}",
    ".att-sep{opacity:.35;flex-shrink:0}",
    ".att-spec{color:" + colors.mut + ";overflow:hidden;text-overflow:ellipsis}",
    ".att-prog{height:3px;border-radius:3px;background:" + colors.el + ";margin-top:7px;overflow:hidden}",
    ".att-prog-bar{height:100%;border-radius:3px;background:linear-gradient(90deg,#10b981,#34d399);transition:width .6s ease}",
    ".att-badge{flex-shrink:0;display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:9px;font-size:10px;font-weight:900;line-height:1.2;white-space:nowrap}",
    ".att-badge svg{width:10px;height:10px}",
    ".att-badge.duty{background:rgba(16,185,129,0.14);color:#34d399}",
    ".att-badge.duty .dot{position:relative;display:inline-block;width:6px;height:6px}",
    ".att-badge.duty .dot::before{content:'';position:absolute;inset:0;border-radius:50%;background:#34d399;animation:pulse 1.8s ease-in-out infinite}",
    ".att-badge.sched{background:rgba(245,158,11,0.14);color:#fbbf24}",
    ".att-badge.now{color:#fff;box-shadow:0 3px 10px -2px rgba(0,0,0,.5)}",
    /* 今日の案内 (issue #1731。?v=18 以降): 最短ご案内・本日満了・受付終了・ルーム・一言 */
    ".att-card.dim{opacity:.62}",
    "a.att-card{color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent;cursor:pointer}",
    "a.att-card:active{transform:scale(.985)}",
    ".att-side{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:4px}",
    ".att-badge.full{background:" + colors.el + ";color:" + colors.mut + "}",
    ".att-next{display:flex;flex-direction:column;align-items:flex-end;line-height:1;padding:5px 9px 5px 10px;border-radius:10px;border:1.5px solid currentColor;background:" + colors.card + "}",
    ".att-next small{font-size:8.5px;font-weight:800;letter-spacing:.08em;opacity:.85}",
    ".att-next b{font-size:15px;font-weight:900;margin-top:2px;letter-spacing:.01em}",
    ".att-next b em{font-style:normal;font-size:10px;margin-left:1px}",
    ".att-wait{font-size:9px;color:" + colors.mut + ";font-weight:700;white-space:nowrap}",
    ".att-wait.soon{color:#d97706}",
    // 次の行に回ったルーム名は 2 行まで折り返す。区切り線は左の gap に置き、行頭に回ったときは
    // .att-row1 の overflow:hidden の外になって消える
    ".att-room{position:relative;flex:0 1 auto;display:inline-flex;align-items:flex-start;gap:3px;font-size:10.5px;font-weight:800;line-height:1.35;color:" + colors.sub + ";min-width:0;align-self:center}",
    ".att-room::before{content:'';position:absolute;left:-8px;top:1px;bottom:1px;border-left:1px solid " + colors.bdrS + "}",
    ".att-room svg{width:10px;height:10px;flex-shrink:0;opacity:.6;margin-top:2px}",
    ".att-room span{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow-wrap:anywhere}",
    // 一言は 2 行まで折り返す (issue #2007)
    ".att-catch{margin-top:4px;font-size:11px;line-height:1.35;color:" + colors.sub + ";overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow-wrap:anywhere}",
    // 更新時刻はロゴの下に中央寄せで流す (右に absolute で置くと狭い設置幅でロゴと重なる)
    ".hdr{flex-direction:column;gap:4px}",
    ".hdr-upd{font-size:9.5px;color:" + colors.mut + ";display:flex;align-items:center;gap:4px;white-space:nowrap}",
    ".hdr-upd i{width:5px;height:5px;border-radius:50%;background:#34d399;animation:pulse 1.8s ease-in-out infinite}",
    /* スタッフグリッド */
    ".staff-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px}",
    ".staff-card{position:relative;aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:" + colors.card + ";animation:fadeUp .4s ease-out both}",
    ".staff-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 20%}",
    ".staff-card .grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.75),rgba(0,0,0,.05) 50%,transparent)}",
    ".staff-card .info{position:absolute;bottom:0;left:0;right:0;padding:8px 6px}",
    ".staff-card .info p{font-size:11px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".staff-card .info p .age{color:rgba(255,255,255,.7);font-weight:700}",
    ".staff-card .info .staff-time{display:flex;align-items:center;gap:3px;font-size:9px;font-weight:700;color:rgba(255,255,255,.9);margin-top:2px;letter-spacing:.01em}",
    ".staff-card .info .staff-time svg{width:9px;height:9px;flex-shrink:0;opacity:.8}",
    ".staff-card .info > span{display:block;font-size:9px;color:rgba(255,255,255,.6);line-height:1.35;margin-top:1px;word-break:keep-all;overflow-wrap:break-word}",
    ".staff-badge{position:absolute;top:6px;left:6px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:7px;font-size:9px;font-weight:900;color:#fff;line-height:1.3;backdrop-filter:blur(4px)}",
    ".staff-badge svg{width:9px;height:9px}",
    ".staff-badge.duty{background:rgba(16,185,129,0.9)}",
    ".staff-badge.sched{background:rgba(245,158,11,0.9)}",
    ".staff-badge.fin{background:rgba(100,116,139,0.75)}",
    ".staff-badge .dot{position:relative;display:inline-flex;width:6px;height:6px}",
    ".staff-badge .dot::before{content:'';position:absolute;inset:0;border-radius:50%;background:#fff;animation:pulse 2s ease-in-out infinite}",
    /* 週間スケジュール (出勤状況) — 1日1行の縦リスト */
    ".sch-list{display:flex;flex-direction:column;border:1px solid " + colors.bdr + ";border-radius:14px;overflow:hidden}",
    ".sch-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-bottom:1px solid " + colors.bdr + ";border-left:3px solid transparent;animation:fadeUp .4s ease-out both}",
    ".sch-row:last-child{border-bottom:none}",
    ".sch-row.off:not(.today){opacity:.55}",
    ".sch-date{display:flex;align-items:center;gap:7px;min-width:0}",
    ".sch-today{font-size:9px;font-weight:900;color:#fff;padding:2px 7px;border-radius:6px;letter-spacing:.03em;flex-shrink:0}",
    ".sch-d{font-size:15px;font-weight:800;color:" + colors.txt + ";letter-spacing:.01em}",
    ".sch-wd{font-size:11px;font-weight:700;color:" + colors.mut + "}",
    ".sch-on{display:flex;align-items:center;gap:9px;flex-shrink:0}",
    ".sch-pill{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:900;color:#34d399;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.28);border-radius:7px;padding:3px 8px;white-space:nowrap}",
    ".sch-dot{width:5px;height:5px;border-radius:50%;background:#34d399}",
    ".sch-time{font-size:13.5px;font-weight:700;color:" + colors.txt + ";white-space:nowrap}",
    ".sch-rest{font-size:12px;font-weight:700;color:" + colors.fnt + ";flex-shrink:0}",
    /* メディア (画像グリッド) */
    ".media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px}",
    ".media-card{position:relative;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:" + colors.card + ";animation:fadeUp .4s ease-out both}",
    ".media-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
    ".media-card .cap{position:absolute;left:0;right:0;bottom:0;padding:14px 6px 5px;font-size:9px;line-height:1.3;color:#fff;background:linear-gradient(to top,rgba(0,0,0,.75),transparent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    /* 投稿0件のセラピストのプロフィール (issue #1641)。写真は media-card を流用して3列に固定 */
    ".pf{padding:12px 12px 4px;display:flex;flex-direction:column;gap:16px}",
    ".pf-note{font-size:11px;color:" + colors.mut + ";text-align:center}",
    ".pf-imgs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}",
    ".pf-h{display:flex;align-items:baseline;gap:6px;font-size:12px;font-weight:800;color:" + colors.sub + ";margin-bottom:8px;letter-spacing:.02em}",
    ".pf-count{font-size:11px;font-weight:700;color:" + colors.mut + "}",
    ".pf-desc{font-size:13px;line-height:1.7;color:" + colors.txt + ";white-space:pre-wrap;word-break:break-word}",
    ".pf-desc .tl-more{font-size:13px}",
    ".pf-ok{padding:10px 12px;border-radius:12px;background:" + colors.card + ";border:1px solid " + colors.bdr + "}",
    ".pf-ok + .pf-ok{margin-top:6px}",
    ".pf-ok-body{font-size:12.5px;line-height:1.65;color:" + colors.txt + ";white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}",
    ".pf-ok-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:6px}",
    ".pf-ok-tag{font-size:10px;font-weight:700;color:" + colors.sub + ";background:" + colors.el + ";border-radius:6px;padding:2px 6px}",
    ".pf-ok-date{margin-left:auto;font-size:10px;color:" + colors.mut + "}",
    /* タイムライン (X 風) */
    ".tl-card{padding:12px 14px;border-bottom:1px solid " + colors.bdr + ";transition:background .15s;animation:fadeUp .4s ease-out both}",
    ".tl-card:hover{background:" + colors.card + "}",
    ".tl-card:last-child{border-bottom:none}",
    ".tl-hdr{display:flex;align-items:flex-start;gap:10px}",
    ".tl-av-wrap{position:relative;flex-shrink:0}",
    ".tl-av,.tl-av-ph{width:40px;height:40px;border:2px solid " + colors.bdr + "}",
    ".tl-av{object-fit:cover;object-position:center 20%;display:block}",
    ".tl-av.circle,.tl-av-ph.circle{border-radius:50%}",
    ".tl-av.square,.tl-av-ph.square{border-radius:10px}",
    ".tl-av-ph{background:" + colors.el + ";display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:" + colors.sub + "}",
    ".tl-duty-dot{position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;border-radius:50%;background:#10b981;border:2px solid " + colors.bg + ";animation:pulse 2s ease-in-out infinite}",
    ".tl-meta{flex:1;min-width:0}",
    ".tl-meta-row{display:flex;align-items:center;gap:5px;line-height:1.2}",
    ".tl-author{font-size:14px;font-weight:700;color:" + colors.txt + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".tl-sep{color:" + colors.mut + ";font-size:12px;flex-shrink:0}",
    ".tl-time{font-size:11px;color:" + colors.mut + ";flex-shrink:0}",
    ".tl-sub{font-size:11px;color:" + colors.mut + ";margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".tl-sched{display:flex;align-items:center;gap:3px;font-size:10px;margin-top:2px}",
    ".tl-sched.on{color:#10b981;font-weight:700}",
    ".tl-sched.off{color:" + colors.mut + "}",
    ".tl-instant{flex-shrink:0;display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:99px;font-size:10px;font-weight:900;color:#fff;align-self:center}",
    ".tl-src{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px}",
    ".tl-src.x{background:" + (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)") + ";color:" + colors.txt + "}",
    ".tl-src.bluesky{background:rgba(14,165,233,0.15);color:#38bdf8}",
    ".tl-src svg{width:10px;height:10px}",
    ".tl-body{padding-left:50px;margin-top:2px;font-size:14px;line-height:1.5;color:" + colors.txt + ";white-space:pre-wrap;word-break:break-word}",
    ".tl-imgs{padding-left:50px;margin-top:8px}",
    ".tl-imgs-grid{border-radius:12px;overflow:hidden;border:1px solid " + colors.bdr + ";display:grid;gap:2px}",
    ".tl-imgs-grid.c1{grid-template-columns:1fr}",
    ".tl-imgs-grid.c1 img{width:100%;max-height:420px;object-fit:contain;display:block;margin:0 auto}",
    /* lazy 読み込み待ち (data-src のみで src 未設定) の単一画像は高さ 0 に潰れて誤って即読み込みされるため、プレースホルダ高さを確保 */
    ".tl-imgs-grid.c1 img[data-src]{min-height:240px;background:" + colors.card + "}",
    ".tl-imgs-grid.c2{grid-template-columns:1fr 1fr}",
    ".tl-imgs-grid.c3{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}",
    ".tl-imgs-grid.c3 img:first-child{grid-row:span 2;aspect-ratio:1/2}",
    ".tl-imgs-grid.c4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}",
    /* c3 は 1枚目も含めて width:100% を当てる (1枚目は上の aspect-ratio だけ上書き)。
       漏らすと原寸 (480px) が 1fr 列の最小幅になって 2・3枚目が幅 0 に潰れ、shrink-to-fit の
       設置先 (inline-block 等) ではウィジェットごと画面外まで広がって右端の予約CTA が
       見切れる (issue #1486) */
    ".tl-imgs-grid.c2 img,.tl-imgs-grid.c3 img,.tl-imgs-grid.c4 img{aspect-ratio:1;object-fit:cover;width:100%;height:100%;display:block}",
    ".tl-likes{padding-left:50px;display:flex;align-items:center;gap:5px;margin-top:8px;font-size:11px;color:" + colors.mut + "}",
    ".tl-more{background:none;border:0;padding:0 0 0 4px;font:inherit;font-size:14px;font-weight:700;color:#60a5fa;cursor:pointer}",
    ".tl-more:hover{text-decoration:underline}",
    /* ローディング */
    ".loading{display:flex;align-items:center;justify-content:center;padding:60px 0}",
    ".spinner{width:24px;height:24px;border:2px solid " + colors.fnt + ";border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite}",
    "@keyframes spin{to{transform:rotate(360deg)}}",
    /* ---- data-columns: タイムラインの複数カラム (指定時のみ .cols が付く) ---- */
    /* グリッドだと段の高さが一番高いカードに揃えられて隙間ができるので、
       段ごとの縦積み (= Pinterest 風) にして JS で低い段へ流し込む。
       段数と振り分けは JS が .root の実幅を見て決める (packColumns) */
    ".body.tl.cols{padding:10px 12px}",
    ".tl-cols{display:flex;align-items:flex-start;gap:10px}",
    ".tl-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}",
    /* 段組みでは下線区切りだと線が段をまたいで繋がらないため、カード自体を枠で囲う */
    ".body.tl.cols .tl-card{border:1px solid " + colors.bdr + ";border-radius:14px;background:" + colors.card + "}",
    /* ---- data-compact: タイムラインを圧縮 (指定時のみ .root に .compact が付く) ---- */
    ".compact .tl-card{padding:8px 10px}",
    ".compact .tl-hdr{gap:8px}",
    ".compact .tl-av,.compact .tl-av-ph{width:28px;height:28px;border-width:1.5px}",
    ".compact .tl-av.square,.compact .tl-av-ph.square{border-radius:8px}",
    ".compact .tl-av-ph{font-size:11px}",
    ".compact .tl-duty-dot{width:9px;height:9px;bottom:-2px;right:-2px}",
    ".compact .tl-author{font-size:13px}",
    /* 本文は 2 行で打ち切り。line-clamp と「さらに表示」は併用できないのでボタンは隠す */
    ".compact .tl-body{padding-left:36px;font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    ".compact .tl-more{display:none}",
    ".compact .tl-imgs,.compact .tl-likes{padding-left:36px}",
    ".compact .tl-imgs{margin-top:6px}",
    ".compact .tl-imgs-grid.c1 img{max-height:260px}",
    ".compact .tl-imgs-grid.c1 img[data-src]{min-height:150px}",
    /* 大バナー (type=featured) — 店舗公式サイトTOP用 (issue #1166)。
       モック (大バナー_モック_v1) 再現: 黒地 + ピンクネオンの光条・グローに
       ネオン枠のカルーセル3枚 + 右ブロック (ロックアップ / メタリック見出し /
       金帯 / ネオンCTA / 信頼バッジ)。設置先での見た目を統一するため
       デザインは常にダーク固定 (data-theme は無視)。
       全面が店舗ページへのリンク (.ft-link を最前面に敷き、矢印だけ
       pointer 対象としてさらに上に置く stretched-link 構成)。
       寸法は --fts (root 実幅から JS が算出する倍率) で一括スケール */
    ".root.ft{max-height:none;overflow:visible;border:none;background:#070208}",
    ".body.ft{padding:0}",
    ".ft-wrap{--fts:1;position:relative;display:flex;align-items:center;padding:calc(26px*var(--fts)) calc(22px*var(--fts));overflow:hidden;border-radius:16px;background:"
      + "radial-gradient(circle 2px at 12% 16%,rgba(255,255,255,.85),transparent 3px),"
      + "radial-gradient(circle 1.5px at 46% 8%,rgba(255,214,234,.7),transparent 2.5px),"
      + "radial-gradient(circle 1.5px at 83% 14%,rgba(255,255,255,.7),transparent 2.5px),"
      + "radial-gradient(circle 2px at 68% 82%,rgba(255,214,234,.55),transparent 3px),"
      + "radial-gradient(circle 1.5px at 30% 90%,rgba(255,255,255,.5),transparent 2.5px),"
      + "linear-gradient(112deg,transparent 40%,rgba(255,45,125,.3) 44%,transparent 49%),"
      + "linear-gradient(64deg,transparent 57%,rgba(255,45,125,.22) 62%,transparent 67%),"
      + "linear-gradient(155deg,transparent 20%,rgba(255,120,175,.16) 25%,transparent 31%),"
      + "linear-gradient(98deg,transparent 74%,rgba(255,45,125,.2) 79%,transparent 84%),"
      + "radial-gradient(circle at 8% 24%,rgba(255,45,125,.32),transparent 36%),"
      + "radial-gradient(circle at 92% 18%,rgba(255,45,125,.24),transparent 32%),"
      + "radial-gradient(circle at 78% 90%,rgba(255,45,125,.2),transparent 34%),"
      + "radial-gradient(ellipse at 50% 45%,#2c0919 0%,#160410 55%,#070208 100%)}",
    ".ft-link{position:absolute;inset:0;z-index:5;cursor:pointer}",
    /* 左: カルーセル */
    /* z-index を付けない: stacking context を作ると内側の .ft-nav (z6) が
       全面リンク .ft-link (z5) より上に出られず、矢印が押せなくなる */
    ".ft-left{position:relative;flex:0 0 46%;min-width:0}",
    ".ft-stage{position:relative;width:100%;aspect-ratio:27/20}",
    ".ft-card{position:absolute;left:50%;top:50%;width:44%;aspect-ratio:3/4.3;border-radius:calc(18px*var(--fts));overflow:hidden;background:#14060e;border:2px solid #ff2d7d;box-shadow:0 0 calc(16px*var(--fts)) rgba(255,45,125,.7),0 0 calc(42px*var(--fts)) rgba(255,45,125,.28);transition:transform .45s cubic-bezier(.2,.7,.2,1),opacity .3s}",
    ".ft-card.pos-c{transform:translate(-50%,-50%);z-index:3}",
    /* 展開量は「側カードが .ft-left の外に出ない」上限で決める。これ以上広げると
       .ft-wrap の overflow:hidden でバナー左端に断ち切られる */
    ".ft-card.pos-l{transform:translate(-118%,-48%) scale(.75) rotate(-8deg);z-index:1;opacity:.92}",
    ".ft-card.pos-r{transform:translate(18%,-48%) scale(.75) rotate(8deg);z-index:1;opacity:.92}",
    /* 縦長カードで顔が切れないよう、上寄せしつつ 12% より控えめに取る */
    ".ft-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 18%}",
    ".ft-card .grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(5,1,4,.96) 0%,rgba(5,1,4,.72) 26%,rgba(5,1,4,.08) 50%,transparent 62%)}",
    /* VIP 金の斜めコーナーリボン (中央枠のモック再現) */
    ".ft-vipband{position:absolute;top:-2px;left:-2px;width:calc(72px*var(--fts));height:calc(72px*var(--fts));overflow:hidden;border-top-left-radius:calc(18px*var(--fts))}",
    ".ft-vipband span{position:absolute;top:calc(15px*var(--fts));left:calc(-32px*var(--fts));width:calc(124px*var(--fts));transform:rotate(-45deg);background:linear-gradient(180deg,#f9e9a0,#d4a437 55%,#a87a1d);color:#3a2703;font-weight:900;font-size:calc(13px*var(--fts));letter-spacing:.16em;text-align:center;padding:calc(2px*var(--fts)) 0;font-style:italic}",
    ".ft-info{position:absolute;left:0;right:0;bottom:0;padding:calc(12px*var(--fts));text-align:center}",
    /* 小さい文字は --fts をそのまま掛けると狭い設置枠で読めなくなるので、
       倍率に下限 (.78) を設けて字だけ痩せすぎないようにする */
    ".ft-tag{display:inline-flex;align-items:center;padding:calc(3px*var(--fts)) calc(13px*var(--fts));border-radius:999px;font-size:calc(11.5px*max(.78,var(--fts)));font-weight:900;letter-spacing:.08em;line-height:1.5}",
    ".ft-tag.hot{background:#ff2d7d;color:#fff;box-shadow:0 0 10px rgba(255,45,125,.6)}",
    ".ft-tag.vip{background:rgba(10,2,7,.72);border:1px solid #ff6aa8;color:#ff9dc6}",
    ".ft-name{font-size:calc(21px*max(.78,var(--fts)));font-weight:900;color:#fff;margin-top:calc(6px*var(--fts));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 6px rgba(0,0,0,.9)}",
    /* keep-all: 折り返すとき「Eカッ / プ」のように語中で切らせない
       (スラッシュ区切りで改行させる) */
    ".ft-spec{font-size:calc(13px*max(.78,var(--fts)));font-weight:700;color:#fff;margin-top:calc(3px*var(--fts));letter-spacing:.03em;word-break:keep-all;text-shadow:0 1px 4px rgba(0,0,0,.9)}",
    ".ft-more{display:inline-flex;align-items:center;margin-top:calc(8px*var(--fts));padding:calc(4px*var(--fts)) calc(16px*var(--fts));border:1.5px solid #ff6aa8;border-radius:999px;font-size:calc(12.5px*max(.78,var(--fts)));font-weight:900;color:#fff;background:rgba(255,45,125,.16)}",
    /* ネオン « » 矢印 (背景なし・グローのみ) */
    /* 写真の上に重なるので、ネオングローに加えて暗い影も足して輪郭を保つ */
    ".ft-nav{position:absolute;top:44%;transform:translateY(-50%);z-index:6;background:none;border:none;padding:6px;cursor:pointer;color:#ff4d9d;font-family:inherit;font-size:calc(44px*var(--fts));font-weight:900;line-height:1;text-shadow:0 0 10px rgba(0,0,0,.9),0 0 14px rgba(255,45,125,.95),0 0 30px rgba(255,45,125,.55);transition:color .15s,transform .15s}",
    ".ft-nav:hover{color:#fff}",
    /* RESET の all:initial が既定の focus ring も消すので、キーボード操作用に明示する */
    ".ft-nav:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:6px}",
    ".ft-nav.prev{left:calc(-10px*var(--fts))}",
    ".ft-nav.next{right:calc(-10px*var(--fts))}",
    ".ft-swipe{display:flex;width:max-content;margin:calc(10px*var(--fts)) auto 0;align-items:center;gap:calc(8px*var(--fts));padding:calc(4px*var(--fts)) calc(18px*var(--fts));border:1px solid rgba(255,109,168,.7);border-radius:999px;color:#ffc3da;font-size:calc(13px*max(.78,var(--fts)));font-weight:700;white-space:nowrap}",
    /* right を負にすると縦積み時に .ft-left = バナー全幅となり、overflow:hidden で
       文末が切れる。0 で内容box の右端に揃える */
    ".ft-flick{position:absolute;right:calc(4px*var(--fts));bottom:calc(20px*var(--fts));z-index:4;display:flex;align-items:center;gap:calc(5px*var(--fts));color:#fff;font-size:calc(14.5px*max(.78,var(--fts)));font-weight:900;transform:rotate(-8deg);text-shadow:0 0 10px rgba(255,45,125,.9);white-space:nowrap}",
    /* 指アイコン: 絵文字は OS ごとに字形も色も変わるので自前の SVG で描く。
       左右への小さな振りがそのまま「フリック」の説明になる */
    ".ft-hand{width:calc(26px*var(--fts));height:calc(26px*var(--fts));flex-shrink:0;display:block;filter:drop-shadow(0 0 calc(5px*var(--fts)) rgba(255,45,125,.95)) drop-shadow(0 1px 2px rgba(0,0,0,.85));animation:ftflick 2.4s ease-in-out infinite}",
    "@keyframes ftflick{0%,100%{transform:translateX(0) rotate(-4deg)}45%{transform:translateX(calc(-6px*var(--fts))) rotate(-16deg)}}",
    "@media (prefers-reduced-motion:reduce){.ft-hand{animation:none}}",
    /* 右: 店舗ブロック */
    ".ft-right{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:calc(17px*var(--fts));padding-left:calc(20px*var(--fts))}",
    /* 「メンエスなう × 店名」は両者が組んでいることを見せる並び。ロゴだけが
       ネオンで浮くと店舗が添え物に見えるので、店名にも同じ発光を与えたうえで、
       下に走らせた光の線で 2 つを 1 つの看板として括る */
    ".ft-lockup{position:relative;display:flex;align-items:center;justify-content:center;gap:calc(11px*var(--fts));flex-wrap:wrap;max-width:100%;padding-bottom:calc(11px*var(--fts))}",
    ".ft-lockup::after{content:'';position:absolute;left:8%;right:8%;bottom:0;height:calc(2px*var(--fts));border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,45,125,.9) 22%,rgba(255,255,255,.9) 50%,rgba(255,45,125,.85) 78%,transparent);box-shadow:0 0 calc(6px*var(--fts)) rgba(255,45,125,.55)}",
    /* 長い店名は既定サイズだと2行に膨らんで右ブロックを押し下げるので、
       文字数に応じて JS が段階的に落とす */
    ".ft-lockup.len-md .ft-store{font-size:calc(24px*var(--fts))}",
    ".ft-lockup.len-lg .ft-store{font-size:calc(19px*var(--fts))}",
    /* 店名のサイズが変わるとベースライン位置も動くので、下げ量も段階ごとに実測値で持つ */
    ".ft-lockup.len-md .ft-brand{top:calc(1.85px*var(--fts))}",
    ".ft-lockup.len-lg .ft-brand{top:0}",
    /* ロゴのワードマークと店名は字の大きさが違うので、ボックス中央で揃えると
       ベースラインがずれて店名だけ下がって見える。ワードマーク下端は画像下端より
       上にある (SVG 実測で高さの 75.6% 位置) ので、その差ぶんロゴを下げて
       文字どうしのベースラインを合わせる。実測で決めた値 (fts=1 で 4.4px) */
    ".ft-brand{height:calc(35px*var(--fts));position:relative;top:calc(4.4px*var(--fts));width:auto;display:block;flex-shrink:0}",
    /* 「×」は店名テキストの一部として流す。別要素にすると長い店名が折り返したとき
       × だけが行頭や行末に取り残されて区切りとして読めなくなる。
       サイズは em 指定で店名の段階縮小に追従させる */
    ".ft-x{font-size:1.2em;font-weight:900;color:#ff5d9e;margin-right:.4em;text-shadow:0 0 calc(10px*var(--fts)) rgba(255,45,125,.9)}",
    ".ft-store{font-size:calc(30px*var(--fts));font-weight:900;color:#fff;line-height:1.25;letter-spacing:.01em;min-width:0;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;text-shadow:0 0 calc(12px*var(--fts)) rgba(255,45,125,.7),0 0 calc(26px*var(--fts)) rgba(255,45,125,.35)}",
    /* メタリック見出し「注目掲載店」(注目=シルバー / 掲載店=ピンク) */
    /* モックでは右ブロックの主役。5文字ぶんが右ブロック幅をほぼ使い切る大きさにする */
    ".ft-headline{font-weight:900;font-size:calc(90px*var(--fts));line-height:1.02;letter-spacing:.03em;white-space:nowrap}",
    ".ft-h1a{background:linear-gradient(180deg,#fff 8%,#eef1f7 38%,#98a1b3 62%,#e6eaf2 88%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;filter:drop-shadow(0 2px 4px rgba(0,0,0,.7))}",
    ".ft-h1b{background:linear-gradient(180deg,#ffa8cd 8%,#ff2d7d 45%,#c11458 68%,#ff77ad 90%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;filter:drop-shadow(0 2px 6px rgba(255,45,125,.5))}",
    ".ft-goldbar{display:flex;align-items:center;justify-content:center;gap:calc(10px*var(--fts));width:100%;max-width:calc(470px*var(--fts));padding:calc(7px*var(--fts)) calc(12px*var(--fts));border-top:1px solid #cfa243;border-bottom:1px solid #cfa243;background:linear-gradient(180deg,rgba(207,162,67,.14),rgba(207,162,67,.04));color:#f0d58a;font-weight:900;font-size:calc(22px*var(--fts));letter-spacing:.12em;white-space:nowrap}",
    ".ft-goldbar .deco{font-size:calc(13px*var(--fts));color:#cfa243;letter-spacing:.02em}",
    ".ft-copy{font-size:calc(20px*var(--fts));font-weight:900;color:#fff;letter-spacing:.02em}",
    ".ft-copy em{font-style:normal;color:#ff5d9e}",
    /* 円形バッジのぶんだけ右を空けて CTA を中央に置く = モックと同じ「CTA は左寄り、
       右に今すぐチェック」の並びになる。バッジを出さない狭幅では余白も戻す */
    ".ft-ctarow{position:relative;display:flex;align-items:center;justify-content:center;width:100%;padding-right:calc(96px*var(--fts))}",
    ".ft-wrap.ft-narrow .ft-ctarow{padding-right:0}",
    ".ft-cta{display:inline-flex;align-items:center;justify-content:center;gap:calc(12px*var(--fts));width:calc(470px*var(--fts));max-width:100%;padding:calc(16px*var(--fts)) calc(24px*var(--fts));border:2px solid #ff2d7d;border-radius:999px;background:rgba(18,3,11,.85);color:#fff;font-size:calc(27px*var(--fts));font-weight:900;letter-spacing:.06em;box-shadow:0 0 calc(26px*var(--fts)) rgba(255,45,125,.75),0 0 calc(56px*var(--fts)) rgba(255,45,125,.35),inset 0 0 calc(16px*var(--fts)) rgba(255,45,125,.25);white-space:nowrap}",
    ".ft-cta svg{width:calc(25px*var(--fts));height:calc(25px*var(--fts))}",
    /* 予約CTA (issue #1445)。バナーは 1 枚絵なので共通の sticky ピル (.cta) は使わず、
       導線行に「掲載ページを見る」と並べる。全面リンク (.ft-link, z5) の上に出さないと
       押せないので z-index を持たせる (.ft-nav と同じ理由)。
       面を塗って主役にするのは予約側だけ = 押し先が違う 2 つが見分けられる */
    ".ft-ctarow.has-book{gap:calc(12px*var(--fts));padding-right:0}",
    /* 予約ボタンを置く幅は円形バッジ (「今すぐチェック」) の居場所から取る。
       absolute で右端に浮いているので、残すとボタンに重なる */
    ".ft-ctarow.has-book .ft-circle{display:none}",
    ".ft-ctarow.has-book .ft-cta{flex:1 1 0;width:auto;min-width:0;font-size:calc(19px*var(--fts));padding:calc(12px*var(--fts)) calc(14px*var(--fts));gap:calc(8px*var(--fts))}",
    ".ft-ctarow.has-book .ft-cta svg{width:calc(18px*var(--fts));height:calc(18px*var(--fts))}",
    ".ft-book{position:relative;z-index:6;flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:calc(8px*var(--fts));padding:calc(13px*var(--fts)) calc(16px*var(--fts));border:2px solid #ffd0e4;border-radius:999px;background:linear-gradient(135deg,#ff7ab4,#ff2d7d 55%,#cf1257);color:#fff;font-family:inherit;font-size:calc(21px*var(--fts));font-weight:900;letter-spacing:.04em;line-height:1.2;white-space:nowrap;text-decoration:none;cursor:pointer;box-shadow:0 0 calc(24px*var(--fts)) rgba(255,45,125,.8),0 calc(3px*var(--fts)) calc(10px*var(--fts)) rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.4);transition:filter .15s,transform .12s}",
    ".ft-book:hover{filter:brightness(1.07)}",
    ".ft-book:active{transform:translateY(1px)}",
    /* RESET の all:initial が既定の focus ring も消すので明示する (.ft-nav と同じ) */
    ".ft-book:focus-visible{outline:2px solid #fff;outline-offset:2px}",
    ".ft-book-ic{display:flex;flex-shrink:0}",
    ".ft-book svg{width:calc(19px*var(--fts));height:calc(19px*var(--fts))}",
    /* 受付時間の注記とデモ表示の断り書き。導線行の下に小さく置く */
    ".ft-ctanote{margin-top:calc(-6px*var(--fts));font-size:calc(12px*var(--fts));font-weight:700;color:#ffc3da;text-align:center}",
    ".ft-circle{position:absolute;right:0;top:50%;transform:translateY(-50%);width:calc(84px*var(--fts));height:calc(84px*var(--fts));border-radius:50%;border:1.5px solid #ff6aa8;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:calc(12px*var(--fts));font-weight:900;line-height:1.4;box-shadow:0 0 14px rgba(255,45,125,.45);background:rgba(18,3,11,.55)}",
    ".ft-circle .dn{color:#ff6aa8;font-size:calc(10px*var(--fts));line-height:1;margin-top:calc(2px*var(--fts))}",
    /* 字を大きくしたぶん 3 つ横並びが折り返しやすくなるので余白側で詰める */
    ".ft-trust{display:flex;align-items:center;justify-content:center;gap:calc(13px*var(--fts));flex-wrap:wrap;margin-top:calc(2px*var(--fts))}",
    ".ft-trust span{display:inline-flex;align-items:center;gap:calc(6px*var(--fts));font-size:calc(13.5px*max(.78,var(--fts)));font-weight:700;color:rgba(255,255,255,.95);white-space:nowrap}",
    ".ft-trust svg{width:calc(14px*max(.78,var(--fts)));height:calc(14px*max(.78,var(--fts)));color:#ff4d9d;flex-shrink:0}",
    /* 中間幅では CTA 横の円形バッジだけ落とす (JS が root 幅 <900 で付与) */
    ".ft-wrap.ft-narrow .ft-circle{display:none}",
    /* 横並びのまま枠が狭い帯 (640〜900px) はカードの実寸が小さく、
       字の下限をそのまま掛けるとスペック 1 行が入らない。ここだけ詰める */
    ".ft-wrap.ft-narrow:not(.ft-stack) .ft-info{padding:calc(9px*var(--fts))}",
    ".ft-wrap.ft-narrow:not(.ft-stack) .ft-spec{font-size:calc(11.5px*max(.72,var(--fts)))}",
    ".ft-wrap.ft-narrow:not(.ft-stack) .ft-name{font-size:calc(18px*max(.72,var(--fts)))}",
    /* 狭い設置枠ではカルーセルと店舗ブロックを縦積みにする (root 幅を見て JS がトグル) */
    ".ft-wrap.ft-stack{flex-direction:column;gap:calc(16px*var(--fts));padding:calc(22px*var(--fts)) calc(16px*var(--fts))}",
    /* 2 つ横並びは日本語 8 文字 x2 が入る幅でだけ成立する。狭い枠と 4:3 の右列は縦に積む */
    ".ft-wrap.ft-stack .ft-ctarow.has-book,.ft-wrap.ft-narrow .ft-ctarow.has-book{flex-direction:column}",
    ".ft-wrap.ft-stack .ft-ctarow.has-book .ft-cta,.ft-wrap.ft-narrow .ft-ctarow.has-book .ft-cta,"
      + ".ft-wrap.ft-stack .ft-book,.ft-wrap.ft-narrow .ft-book{flex:none;width:calc(470px*var(--fts));max-width:100%}",
    ".ft-wrap.ft-stack .ft-left{flex:none;width:100%}",
    /* 縦積みではカードの実寸が横並びより小さく、スペック 1 行が入りきらないので
       カードを広げる。広げたぶん左右への展開量は枠内に収まる値へ戻す */
    ".ft-wrap.ft-stack .ft-card{width:52%}",
    ".ft-wrap.ft-stack .ft-card.pos-l{transform:translate(-105%,-48%) scale(.75) rotate(-8deg)}",
    ".ft-wrap.ft-stack .ft-card.pos-r{transform:translate(5%,-48%) scale(.75) rotate(8deg)}",
    /* 縦積みでは align-items:center により幅が shrink-to-fit になるため、
       明示的に 100% を与えないと中身の max-content 幅がバナーからはみ出す */
    ".ft-wrap.ft-stack .ft-right{flex:none;width:100%;padding-left:0}",
    ".ft-wrap.ft-stack .ft-headline{font-size:calc(58px*var(--fts))}",
    ".ft-wrap.ft-stack .ft-brand{height:calc(29px*var(--fts));top:calc(1.8px*var(--fts))}",
    ".ft-wrap.ft-stack .ft-store{font-size:calc(21px*var(--fts))}",
    /* 3つ横並びはスマホ幅で 2+1 に折り返して不格好になるので縦の箇条書きにする。
       行数が増えるぶん字が小さくなりすぎないよう少し大きめに戻す */
    ".ft-wrap.ft-stack .ft-trust{flex-direction:column;align-items:center;gap:calc(6px*var(--fts))}",
    ".ft-wrap.ft-stack .ft-trust span{font-size:calc(13px*var(--fts))}",
    ".ft-wrap.ft-stack .ft-flick{bottom:calc(34px*var(--fts))}",
    /* 4:3 (issue #1286): 正方形に近い設置枠向けの左右2列。左列はカードが枠の高さいっぱいに
       立ち、右列に店舗ブロックを縦積みする (JS が root 幅 480px 以上 + data-ratio で付与)。
       aspect-ratio は厳密に効く = 中身が入りきらなくても枠は伸びない。この箱は flex
       コンテナなので自動 min-height は 0 のままで、overflow を clip / visible にしても
       min-height:min-content を足しても伸びないことを実測済み。溢れた分は基底の
       overflow:hidden で黙って切り落とされるため、「入りきること」を CSS 任せにはできない。
       拠り所は寸法が幅に対して比例不変であること: --fts (= w/600) と各列幅がどちらも w に
       比例するので、480〜810px の全域で「中身 : 枠」の比が一定になる。810px を超える幅は
       --fts が 1.35 で頭打ちになるぶん余裕が増えるだけ。したがって数点の幅で収まれば
       全域で収まる (実測: 480 / 600 / 800 / 810 / 1000 / 1400px、長い店名・セラピスト0人
       の縮退バナーでも 4:3 厳守・溢れなし)。r43 の寸法を触るときはこの比例関係を壊さないこと。
       等倍は幅 600px (applyFtStack の --fts 算出と対) */
    ".ft-wrap.ft-r43{aspect-ratio:4/3;align-items:stretch;padding:calc(20px*var(--fts)) calc(18px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-left{flex:0 0 50%;display:flex;flex-direction:column;justify-content:center}",
    /* ステージは列幅ではなく枠の高さからカード寸法を決める (高さ基準 + aspect-ratio で幅が決まる) */
    ".ft-wrap.ft-r43 .ft-stage{aspect-ratio:auto;flex:1;min-height:0}",
    ".ft-wrap.ft-r43 .ft-card{width:auto;height:74%}",
    /* 側カードの展開量は横長版と同じく「左列の外に出ない」上限。右にはみ出すと右列の字に被る */
    ".ft-wrap.ft-r43 .ft-card.pos-l{transform:translate(-85%,-48%) scale(.75) rotate(-8deg)}",
    ".ft-wrap.ft-r43 .ft-card.pos-r{transform:translate(-15%,-48%) scale(.75) rotate(8deg)}",
    ".ft-wrap.ft-r43 .ft-nav{top:50%}",
    ".ft-wrap.ft-r43 .ft-flick{bottom:calc(40px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-right{justify-content:center;gap:calc(12px*var(--fts));padding-left:calc(14px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-headline{font-size:calc(52px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-brand{height:calc(29px*var(--fts));top:calc(1.8px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-store{font-size:calc(21px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-lockup.len-md .ft-store{font-size:calc(18px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-lockup.len-lg .ft-store{font-size:calc(15px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-goldbar{font-size:calc(16px*var(--fts));padding:calc(5px*var(--fts)) calc(10px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-copy{font-size:calc(15px*var(--fts))}",
    /* 円形バッジは右列に置く幅が無いので常に落とす */
    ".ft-wrap.ft-r43 .ft-ctarow{padding-right:0}",
    ".ft-wrap.ft-r43 .ft-circle{display:none}",
    ".ft-wrap.ft-r43 .ft-cta{font-size:calc(18px*var(--fts));padding:calc(11px*var(--fts)) calc(18px*var(--fts));gap:calc(8px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-cta svg{width:calc(18px*var(--fts));height:calc(18px*var(--fts))}",
    /* 4:3 は高さが伸びない (aspect-ratio + flex) ので、導線を 2 行にすると信頼バッジが
       枠外へ押し出される (実測で余白 6px しか残っていない)。ここだけは予約を優先し、
       掲載ページへの導線はバナー全面のリンク (.ft-link) に任せて 1 行のままにする */
    ".ft-wrap.ft-r43 .ft-ctarow.has-book .ft-cta{display:none}",
    ".ft-wrap.ft-r43 .ft-book{width:100%;font-size:calc(17px*var(--fts));padding:calc(10px*var(--fts)) calc(14px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-book svg{width:calc(16px*var(--fts));height:calc(16px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-ctanote{font-size:calc(11px*var(--fts));margin-top:calc(-8px*var(--fts))}",
    /* 予約ボタンと受付時間の注記が増えるぶん、行間を詰めて枠内に収める
       (4:3 は高さが伸びないので、足したら同じだけどこかで返す) */
    ".ft-wrap.has-book.ft-r43 .ft-right{gap:calc(9px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-trust{flex-direction:column;align-items:center;gap:calc(4px*var(--fts))}",
    ".ft-wrap.ft-r43 .ft-trust span{font-size:calc(12px*var(--fts))}",
  ].join("\n");
  // 推しコメ (issue #1235) の意匠は本体セラピスト詳細の推しコメセクション (#353) の縮約移植。
  // カラーは node/src/input.css の @theme 実トークン (primary #f53d7b 系 / bg-deep / bg-card) と
  // :root[data-theme="light"] の実値。他 type の DOM を重くしないよう oshikome のときだけ足す
  if (type === "oshikome") style.textContent += "\n" + oshikomeCss();

  function oshikomeCss() {
    // CSS 変数で両テーマを吸収する (テーマは埋め込み単位で固定なので有効側だけ出す)
    var v = dark
      ? "--w-bg:hsl(222 47% 11%);--w-card:#1F2538;--w-elev:#252B3F;--w-elev40:rgba(37,43,63,0.4);"
        + "--w-border:hsl(222 20% 22%);--w-line:rgba(51,65,85,0.15);--w-line2:rgba(51,65,85,0.20);--w-line3:rgba(51,65,85,0.25);"
        + "--w-h:#f1f5f9;--w-t90:rgba(226,232,240,0.90);--w-t80:rgba(226,232,240,0.80);--w-t70:rgba(226,232,240,0.70);"
        + "--w-t60:rgba(226,232,240,0.60);--w-t55:rgba(226,232,240,0.55);--w-t45:rgba(226,232,240,0.45);"
        + "--w-t40:rgba(226,232,240,0.40);--w-t30:rgba(226,232,240,0.30);"
        + "--w-p300:#fda4c6;--w-p400:#fb6b9f;--w-ink:#f53d7b;"
        + "--w-p10:rgba(245,61,123,0.10);--w-p14:rgba(245,61,123,0.14);--w-p16:rgba(245,61,123,0.16);"
        + "--w-pb25:rgba(245,61,123,0.25);--w-pb30:rgba(245,61,123,0.30);--w-pb40:rgba(245,61,123,0.40);--w-pb50:rgba(245,61,123,0.50);"
        + "--w-green:#4ade80;--w-green-t:rgba(74,222,128,0.80);--w-green-bg:rgba(34,197,94,0.15);--w-green-bd:rgba(34,197,94,0.30);"
        + "--w-amber:#fcd34d;--w-amber-bg:rgba(251,191,36,0.10);--w-amber-bd:rgba(251,191,36,0.25);"
        + "--w-disabled:rgba(226,232,240,0.10);--w-shadow-card:0 1px 2px rgba(0,0,0,0.25);"
      : "--w-bg:#f5f7fa;--w-card:#ffffff;--w-elev:#ffffff;--w-elev40:#ffffff;"
        + "--w-border:hsl(220 14% 89%);--w-line:rgba(51,65,85,0.15);--w-line2:rgba(51,65,85,0.20);--w-line3:rgba(51,65,85,0.25);"
        + "--w-h:#0f172a;--w-t90:rgba(2,6,23,0.90);--w-t80:rgba(2,6,23,0.80);--w-t70:rgba(2,6,23,0.70);"
        + "--w-t60:rgba(2,6,23,0.60);--w-t55:rgba(2,6,23,0.55);--w-t45:rgba(2,6,23,0.45);"
        + "--w-t40:rgba(2,6,23,0.40);--w-t30:rgba(2,6,23,0.30);"
        + "--w-p300:#bf0e3b;--w-p400:#bf0e3b;--w-ink:#bf0e3b;"
        + "--w-p10:rgba(245,61,123,0.10);--w-p14:rgba(245,61,123,0.14);--w-p16:rgba(245,61,123,0.12);"
        + "--w-pb25:rgba(245,61,123,0.28);--w-pb30:rgba(245,61,123,0.32);--w-pb40:rgba(245,61,123,0.42);--w-pb50:rgba(245,61,123,0.50);"
        + "--w-green:#15803d;--w-green-t:rgba(21,128,61,0.90);--w-green-bg:rgba(34,197,94,0.12);--w-green-bd:rgba(34,197,94,0.30);"
        + "--w-amber:#8a6407;--w-amber-bg:rgba(251,191,36,0.14);--w-amber-bd:rgba(202,138,4,0.35);"
        + "--w-disabled:rgba(2,6,23,0.12);--w-shadow-card:0 1px 2px rgba(15,23,42,0.06),0 1px 3px rgba(15,23,42,0.10);";
    return [
      /* ルート: 内部スクロールはカード一覧 (.osw-list) とフォーム本体に持たせ、
         枠自体は展開表示。設置先のレイアウトを動かさないよう、ビュー切替時の高さは
         JS が一覧ビューの実高さに合わせて固定する */
      ".root.ok{" + v + "max-height:none;overflow:visible;background:var(--w-bg);border-color:var(--w-border);color:var(--w-t90);line-height:1.6;"
        + "--font-display:'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',Georgia,serif}",
      /* ライトではロゴの白文字を紺に落とす (単色バリアント運用) */
      dark ? "" : ".osw-logo .cls-3{fill:#1F2538}",
      /* ── セクション見出し ── */
      ".osw-head{display:flex;align-items:center;gap:8px;padding:14px 14px 11px}",
      ".osw-head-dot{width:6px;height:6px;border-radius:50%;background:#e51d57;flex-shrink:0}",
      ".osw-head-tt{font-size:17px;font-weight:700;line-height:1.3;color:var(--w-h)}",
      ".osw-head-n{font-size:11px;font-weight:700;color:var(--w-t45);font-feature-settings:'tnum'}",
      ".osw-write-pill{margin-left:auto;display:inline-flex;align-items:center;gap:4px;flex-shrink:0;white-space:nowrap;font-size:10px;font-weight:900;color:#fff;background:#e51d57;border:0;cursor:pointer;padding:6px 12px;border-radius:99px;font-family:inherit;transition:background .15s,transform .1s}",
      ".osw-write-pill svg{width:11px;height:11px;flex-shrink:0}",
      ".osw-write-pill:hover{background:#c70f3e}",
      ".osw-write-pill:active{transform:scale(.95)}",
      /* 「推しコメ」だけでは何のことか伝わらないので、見出しの直下に常時一文添える (#1551) */
      ".osw-head-desc{padding:0 14px 8px;margin-top:-6px;font-size:11px;line-height:1.5;color:var(--w-t55)}",
      ".osw-head-store{padding:0 14px 10px;margin-top:-6px;font-size:10px;color:var(--w-t45)}",
      /* ── 集計サマリーカード (授賞式) ── */
      ".osw-sum{margin:0 12px;border-radius:16px;border:1px solid var(--w-line);background:var(--w-elev40);overflow:hidden;box-shadow:var(--w-shadow-card)}",
      ".osw-sum-pad{padding:14px 14px 0}",
      ".osw-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
      ".osw-title-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--w-p300);background:var(--w-p10);border:1px solid var(--w-pb25)}",
      ".osw-title-badge svg{width:11px;height:11px;flex-shrink:0}",
      ".osw-area-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:99px;font-size:10px;font-weight:700;font-feature-settings:'tnum';color:var(--w-amber);background:var(--w-amber-bg);border:1px solid var(--w-amber-bd)}",
      ".osw-area-badge svg{width:10px;height:10px}",
      ".osw-headline{margin-top:11px;font-size:17px;line-height:1.6;font-weight:700;color:var(--w-h);font-family:var(--font-display)}",
      ".osw-headline em{font-style:normal;color:var(--w-p300);text-decoration:underline;text-decoration-color:var(--w-pb40);text-decoration-thickness:1px;text-underline-offset:4px}",
      ".osw-sum-cap{margin-top:7px;font-size:10px;color:var(--w-t45)}",
      /* 表彰台 (2位・1位・3位。メタリック順位数字は本体 .rank-num と同グラデ) */
      ".osw-podium{display:flex;align-items:flex-end;gap:8px;padding:14px 12px 0}",
      ".pod{flex:1;min-width:0;animation:oshi-pod-in .5s ease-out backwards}",
      ".pod-1{flex:1.2;position:relative;animation-delay:90ms}",
      ".pod-3{animation-delay:180ms}",
      "@keyframes oshi-pod-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
      "@media (prefers-reduced-motion: reduce){.pod{animation:none}}",
      ".pod-rank{margin:0 auto 6px;width:24px;height:24px;border-radius:50%;background:var(--w-card);border:1px solid var(--w-line3);display:flex;align-items:center;justify-content:center}",
      ".rank-num{font-family:var(--font-display);font-weight:600;font-size:14px;line-height:.9;-webkit-background-clip:text;background-clip:text;color:transparent}",
      ".rank-num-silver{background-image:linear-gradient(152deg,#ffffff 0%,#d2dbe6 44%,#8b99ac 70%,#eef3f9 100%)}",
      ".rank-num-bronze{background-image:linear-gradient(152deg,#ffd9b0 0%,#d2823a 50%,#8c4f23 74%,#f2ab6e 100%)}",
      ".pod-card{border-radius:12px;background:var(--w-card);border:1px solid var(--w-line2);padding:12px 6px;text-align:center}",
      ".pod-card.silver{box-shadow:0 10px 30px -18px rgba(203,213,225,0.38)}",
      ".pod-card.bronze{box-shadow:0 10px 30px -18px rgba(217,119,6,0.38)}",
      ".pod-label{font-size:13px;font-weight:900;color:var(--w-h);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".pod-count{margin-top:2px;font-size:10px;color:var(--w-t55);font-feature-settings:'tnum'}",
      ".pod-crown{position:absolute;top:-12px;left:50%;transform:translateX(-50%);z-index:2;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#fcd34d,#f59e0b 55%,#b45309);border:1px solid rgba(252,211,77,0.6);box-shadow:0 3px 12px rgba(251,191,36,0.4);display:flex;align-items:center;justify-content:center;color:#fffbeb}",
      ".pod-crown svg{width:13px;height:13px}",
      ".pod-card.gold{border:1.5px solid var(--w-pb50);background:linear-gradient(to bottom,var(--w-p16),var(--w-card));padding:20px 6px 14px;box-shadow:0 10px 30px -18px rgba(243,193,74,0.40)}",
      ".pod-card.gold .pod-label{font-size:17px}",
      ".pod-card.gold .pod-count{font-size:11px;font-weight:700;color:var(--w-p300)}",
      ".pod-note{margin-top:4px;font-size:8.5px;white-space:nowrap;color:var(--w-t45)}",
      /* ほかにもチップ */
      ".osw-extra{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;padding:12px 14px 0}",
      ".osw-extra-label{font-size:10px;color:var(--w-t45)}",
      ".osw-extra-chip{padding:4px 10px;border-radius:99px;font-size:11px;color:var(--w-t80);background:var(--w-card);border:1px solid var(--w-line2)}",
      ".osw-extra-chip b{margin-left:4px;font-weight:700;color:var(--w-t45);font-feature-settings:'tnum'}",
      ".osw-sum-foot{margin-top:13px;padding:10px 14px;border-top:1px solid var(--w-line);text-align:center;font-size:10px;color:var(--w-t45)}",
      /* ── 直近推しコメ静的カード (本体と同型) ── */
      ".osw-list{max-height:384px;overflow-y:auto;padding:10px 12px 2px;scrollbar-width:thin;overscroll-behavior:contain}",
      ".osw-card{border-radius:16px;border:1px solid var(--w-line);background:var(--w-card);padding:14px;margin-bottom:10px;box-shadow:var(--w-shadow-card)}",
      ".osw-card-h{display:flex;align-items:center;gap:10px}",
      ".osw-av{width:36px;height:36px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#f53d7b,#f59e0b);display:grid;place-items:center;font-size:13px;font-weight:900;color:#fff}",
      ".osw-card-meta{flex:1;min-width:0}",
      ".osw-card-nm{font-size:12px;font-weight:700;color:var(--w-h);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".osw-card-dt{font-size:10px;color:var(--w-t45);font-feature-settings:'tnum'}",
      ".osw-guest{flex-shrink:0;padding:2px 8px;border-radius:99px;font-size:9px;color:var(--w-t55);background:var(--w-elev);border:1px solid var(--w-line2)}",
      ".osw-card-body{margin-top:11px;font-size:12.5px;line-height:1.85;color:var(--w-t90);white-space:pre-wrap;overflow-wrap:break-word}",
      /* 長文は畳んでその場で開く。本体へ送らないので外部リンクにはしない */
      ".osw-clamp{position:relative}",
      ".osw-clamp .osw-card-body{max-height:9.3em;overflow:hidden}",
      ".osw-clamp-fade{position:absolute;left:0;right:0;bottom:0;height:4.5em;pointer-events:none;background:linear-gradient(to top,var(--w-card),color-mix(in srgb,var(--w-card) 60%,transparent) 55%,transparent)}",
      ".osw-more{margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--w-p300);background:none;border:0;padding:0;cursor:pointer;font-family:inherit}",
      ".osw-more svg{width:11px;height:11px}",
      ".osw-more:hover{color:var(--w-ink)}",
      /* ティーザー (本体の非会員60字リード + フェードと同型。ウィジェットでは本体へ送客) */
      ".osw-card-tags{margin-top:11px;padding-top:11px;border-top:1px solid var(--w-line);display:flex;flex-wrap:wrap;gap:6px}",
      ".osw-card-tag{padding:4px 10px;border-radius:8px;font-size:10px;font-weight:700;color:var(--w-p300);background:var(--w-p14)}",
      ".osw-card-rec{padding:4px 10px;border-radius:8px;font-size:10px;color:var(--w-t70);border:1px solid var(--w-line3)}",
      /* 店舗単位のカードは宛先セラピストが主見出し、投稿者はその下に従属表示 (#1551) */
      ".osw-card-to-nm{display:flex;align-items:baseline;gap:3px;min-width:0;font-size:15px;font-weight:700;line-height:1.35;color:var(--w-h)}",
      ".osw-card-to-nm span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".osw-card-to-nm small{flex-shrink:0;font-size:11px;font-weight:400;color:var(--w-t55)}",
      /* 狭い枠では「この人に書く」に幅を取られるので、省略せずバッジ・日付を次の行へ折り返す */
      ".osw-card-by{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;min-width:0;margin-top:1px;font-size:10.5px;color:var(--w-t55)}",
      ".osw-card-by-nm{max-width:100%;overflow-wrap:anywhere}",
      ".osw-card-by .osw-guest{padding:1px 6px}",
      ".osw-card-by .osw-card-dt{flex-shrink:0}",
      /* 在籍中の宛先ならフォームの初期選択を兼ねた「この人に書く」ボタンを出す */
      ".osw-card-to{flex-shrink:0;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:99px;font-size:10.5px;font-weight:700;color:var(--w-p300);background:var(--w-p14);border:1px solid transparent;font-family:inherit;white-space:nowrap}",
      ".osw-card-to svg{width:11px;height:11px;flex-shrink:0}",
      ".osw-card-to.act{cursor:pointer;border-color:var(--w-pb30);transition:border-color .12s,background .12s}",
      ".osw-card-to.act:hover{border-color:var(--w-pb50);background:var(--w-p16)}",
      ".osw-loader{display:flex;justify-content:center;padding:4px 0 12px}",
      ".osw-empty{padding:26px 14px;text-align:center;font-size:12px;color:var(--w-t45)}",
      /* ── 大CTA (本体の from-primary-400 via-primary-500 to-rose-600 と同グラデ) ── */
      ".osw-cta-wrap{padding:2px 12px 12px}",
      ".osw-cta{width:100%;height:48px;border:0;border-radius:16px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#fb6b9f,#f53d7b 50%,#e11d48);color:#fff;font-size:13px;font-weight:900;box-shadow:0 8px 22px -8px rgba(245,61,123,0.6);transition:transform .12s}",
      ".osw-cta:active{transform:scale(.99)}",
      ".osw-cta svg{width:14px;height:14px}",
      /* ── フッター (実ロゴ + 本体への導線) ── */
      ".osw-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-top:1px solid var(--w-line);background:var(--w-card)}",
      ".osw-brand{display:inline-flex;align-items:center;gap:6px;min-width:0}",
      ".osw-brand .pw{font-size:8.5px;font-weight:700;letter-spacing:.04em;color:var(--w-t40);white-space:nowrap}",
      ".osw-logo{height:12px;width:auto;display:block}",
      ".osw-foot a{flex-shrink:0;font-size:10.5px;font-weight:700;color:var(--w-ink);text-decoration:none;white-space:nowrap}",
      /* ══ フォームビュー (本体の投稿モーダル準拠) ══ */
      /* 高さは JS が固定するので、伸びる余地は本体 (.osw-form-body) の内部スクロールへ逃がす。
         見出しと送信ボタンは常に見えたまま */
      ".osw-form{padding:0 0 14px;display:flex;flex-direction:column;height:100%}",
      ".osw-form-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 14px 13px;border-bottom:1px solid var(--w-border)}",
      ".osw-form-tt{font-size:16px;font-weight:900;letter-spacing:-.01em;color:var(--w-h);line-height:1}",
      ".osw-form-sub{margin-top:5px;font-size:10px;color:var(--w-t55)}",
      ".osw-close{flex-shrink:0;width:34px;height:34px;border-radius:50%;cursor:pointer;background:color-mix(in srgb,var(--w-card) 60%,transparent);border:1px solid var(--w-border);color:var(--w-t60);display:grid;place-items:center;transition:color .15s}",
      ".osw-close:hover{color:var(--w-h)}",
      ".osw-close svg{width:16px;height:16px}",
      ".osw-form-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 14px 0;display:flex;flex-direction:column;gap:16px}",
      ".osw-flabel{display:block;font-size:12px;font-weight:700;color:var(--w-t55);margin-bottom:8px}",
      ".osw-flabel .req{color:var(--w-p400)}",
      ".osw-flabel .opt{font-size:10px;font-weight:400;color:var(--w-t30);margin-left:4px}",
      ".osw-sel-t{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--w-card);border:1px solid var(--w-pb30)}",
      ".osw-sel-t .av{width:34px;height:34px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#f3b0cc,#c9a0f0);display:grid;place-items:center;font-size:13px;font-weight:900;color:#fff;overflow:hidden}",
      ".osw-sel-t .av img{width:100%;height:100%;object-fit:cover;object-position:center 20%}",
      ".osw-sel-t .nm{font-size:13px;font-weight:700;color:var(--w-h)}",
      ".osw-tag-groups{display:flex;flex-direction:column;gap:12px}",
      ".osw-tag-cat{font-size:10px;font-weight:700;color:var(--w-t40);margin-bottom:6px}",
      ".osw-chips{display:flex;flex-wrap:wrap;gap:7px}",
      ".osw-chip{padding:6px 12px;border-radius:99px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:var(--w-card);color:var(--w-t70);border:1px solid var(--w-border);transition:all .12s}",
      ".osw-chip:hover{border-color:var(--w-pb40)}",
      ".osw-chip:active{transform:scale(.95)}",
      ".osw-chip.sel{background:#e51d57;border-color:#f53d7b;color:#fff}",
      ".osw-chip.sel-soft{background:rgba(245,61,123,0.20);border-color:var(--w-pb50);color:var(--w-p300)}",
      ".osw-input,.osw-ta{width:100%;background:var(--w-card);border:1px solid var(--w-border);border-radius:12px;padding:11px 14px;font-size:13px;color:var(--w-h);font-family:inherit;outline:none;transition:border-color .15s}",
      ".osw-input::placeholder,.osw-ta::placeholder{color:var(--w-t30)}",
      ".osw-input:focus,.osw-ta:focus,.osw-select:focus{border-color:#f53d7b}",
      /* 宛先セレクト (店舗単位)。RESET で消えた矢印を背景画像で描き直す */
      ".osw-select{width:100%;background:var(--w-card);border:1px solid var(--w-border);border-radius:12px;"
        + "padding:11px 34px 11px 14px;font-size:13px;color:var(--w-h);font-family:inherit;outline:none;cursor:pointer;"
        + "appearance:none;-webkit-appearance:none;transition:border-color .15s;"
        + "background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f53d7b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\");"
        + "background-repeat:no-repeat;background-position:right 12px center;background-size:14px}",
      // option は設置先ではなく OS 側が描くため、暗い背景を継承できず読めなくなる端末がある
      ".osw-select option{color:#1f2538;background:#fff}",
      ".osw-select:disabled{opacity:.6;cursor:default}",
      ".osw-roster-q{margin-bottom:7px}",
      /* 失敗表示の色は .osw-err と揃える (ブランドのピンクだと dark でアクセントに見える) */
      ".osw-roster-err{margin-top:6px;font-size:11px;color:#f87171}",
      ".osw-book-note{margin-top:10px;font-size:10.5px;color:var(--w-t45);line-height:1.7}",
      ".osw-roster-retry{margin-left:6px;font-size:11px;font-weight:700;color:var(--w-p300);background:none;border:0;padding:0;cursor:pointer;font-family:inherit;text-decoration:underline}",
      ".osw-ta{resize:none;line-height:1.7}",
      ".osw-counter-row{display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding:0 4px}",
      ".osw-counter-left{font-size:10px;color:var(--w-t30)}",
      ".osw-counter-left.ok{color:var(--w-green-t)}",
      ".osw-counter-right{font-size:10px;color:var(--w-t40);font-feature-settings:'tnum'}",
      ".osw-extras-btn{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--w-t55);background:none;border:0;cursor:pointer;font-family:inherit;padding:0}",
      ".osw-extras-btn svg{width:12px;height:12px;transition:transform .18s}",
      ".osw-extras-btn.open svg{transform:rotate(180deg)}",
      ".osw-extras{margin-top:13px;padding-top:13px;border-top:1px dashed var(--w-line2);display:none;flex-direction:column;gap:16px}",
      ".osw-extras.open{display:flex}",
      ".osw-fnote{font-size:9.5px;color:var(--w-t40);margin-top:6px}",
      ".osw-ts{display:flex;justify-content:center;min-height:0}",
      ".osw-form-foot{flex:none;margin-top:16px;padding:12px 14px 0;border-top:1px solid var(--w-border)}",
      ".osw-err{margin-bottom:8px;text-align:center;font-size:11px;font-weight:700;color:#f87171}",
      ".osw-submit{width:100%;height:50px;border:0;border-radius:16px;cursor:pointer;font-family:inherit;background:#e51d57;color:#fff;font-size:13px;font-weight:900;box-shadow:0 10px 15px -3px rgba(245,61,123,0.2),0 4px 6px -4px rgba(245,61,123,0.2);display:flex;align-items:center;justify-content:center;gap:8px;transition:background .15s,transform .1s,opacity .15s}",
      ".osw-submit:not(:disabled):hover{background:#c70f3e}",
      ".osw-submit:not(:disabled):active{transform:scale(.98)}",
      ".osw-submit:disabled{background:var(--w-disabled);box-shadow:none;opacity:.5;cursor:not-allowed}",
      ".osw-submit svg{width:15px;height:15px}",
      /* 回転は既存 @keyframes spin (共通 CSS) を流用 */
      ".osw-spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}",
      ".osw-trust{margin-top:10px;text-align:center;font-size:9.5px;line-height:1.6;color:var(--w-t40)}",
      ".osw-trust b{font-weight:700}",
      /* ══ 完了ビュー (本体の完了画面と同文言・同意匠) ══ */
      ".osw-done{height:100%;padding:40px 22px 28px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}",
      ".osw-done-ic{width:56px;height:56px;border-radius:50%;margin-bottom:16px;background:var(--w-green-bg);border:1px solid var(--w-green-bd);display:grid;place-items:center;color:var(--w-green);animation:osw-popin .4s cubic-bezier(.2,1.6,.4,1)}",
      "@keyframes osw-popin{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}",
      ".osw-done-ic svg{width:28px;height:28px}",
      ".osw-done h4{font-size:16px;font-weight:900;color:var(--w-h);margin-bottom:6px}",
      ".osw-done .d1{font-size:12px;color:var(--w-t60);margin-bottom:6px}",
      ".osw-done .d2{font-size:11px;color:var(--w-t40);line-height:1.7}",
      ".osw-done-btn{margin-top:22px;padding:11px 34px;border-radius:12px;cursor:pointer;font-family:inherit;background:var(--w-card);border:1px solid var(--w-border);color:var(--w-h);font-size:13px;font-weight:700;transition:background .15s}",
    ].join("\n");
  }
  shadow.appendChild(style);

  // ルート
  var root = document.createElement("div");
  // タイムラインは内部スクロール領域を広めに取る (.root.tl)。大バナーは内部スクロールなし (.root.ft)
  var rootCls = type === "timeline" ? "root tl" : type === "featured" ? "root ft" : type === "oshikome" ? "root ok" : "root";
  if (compact) rootCls += " compact";
  root.className = rootCls;
  // data-height は CSS の max-height を inline で上書きする
  if (heightMode === "px") {
    root.style.maxHeight = heightPx + "px";
  } else if (heightMode === "auto") {
    root.style.maxHeight = "none";
    // 内部スクロールが無い状態で overscroll-behavior:contain が残ると、
    // ウィジェット上にカーソル/指があるときホイールやスワイプがページ側へ伝わらず
    // 「ウィジェットの上ではスクロールできない」状態になる
    root.style.overscrollBehavior = "auto";
  }
  // 枠いっぱいに伸ばす。溢れた分は .root の overflow-y:auto で枠内スクロールになるので、
  // iframe 自体にスクロールバーが出ることはない。
  // overscroll-behavior は data-height="auto" と同じ理由で contain を外す: fill は
  // 中身が薄い店で枠を埋めるのが目的 = 内部スクロールが無い状態が常態で、contain のままだと
  // 枠全体 (iframe 全域) が設置先ページのスクロールを止めるトラップになる
  if (fill) {
    root.style.height = "100%";
    root.style.maxHeight = "none";
    root.style.overflowY = "auto";
    root.style.overscrollBehavior = "auto";
  }
  root.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  shadow.appendChild(root);

  // fill でも親ページへ中身の高さを通知できるようにする (issue #1531)。fill の body は
  // 常にビューポート高なので、ラッパー (embed.html) は body を測れず、closed shadow の
  // 中身も覗けない。そこで fill を外したときの高さ (CSS の max-height で頭打ち・溢れた
  // 分は枠内スクロール) をここで測って渡す。枠がこの高さに縮んでも fill のまま =
  // overscroll-behavior:auto のままなので、ページのスクロールは塞がない。
  // 測る間だけ height を外して同じタスク内で戻すので描画には出ない (scrollTop は
  // 縮めた瞬間に丸められるため退避して戻す)。
  // 返り値: null = まだ送らない (読み込み中 / 枠の幅が未確定 / レイアウト前) / 0 = 非表示 (404 で畳む) / 実測値。
  // 読み込み中の高さを送ると、枠が一旦ローディングの高さまで縮んでから伸びる二段リサイズになる
  if (fill) {
    window.mnWidgetMeasure = function () {
      if (host.style.display === "none") return 0;
      // 設置先が描画していない間 (背景タブ等) は iframe の幅が 0 のままで、文字が 1 字ずつ
      // 折り返した高さが出る。幅が決まると resize が来て測り直すので、それまで送らない
      if (!window.innerWidth) return null;
      var first = root.firstElementChild;
      if (root.childElementCount === 1 && first.className === "loading") return null;
      var top = root.scrollTop;
      host.style.height = "";
      root.style.height = "";
      root.style.maxHeight = heightMode === "px" ? heightPx + "px" : heightMode === "auto" ? "none" : "";
      var h = host.getBoundingClientRect().height;
      host.style.height = "100%";
      root.style.height = "100%";
      root.style.maxHeight = "none";
      // 慣性スクロール中に毎回書き込むとプログラムからのスクロールで止まりうるので、
      // 丸められたときだけ戻す
      if (root.scrollTop !== top) root.scrollTop = top;
      // 枠のレイアウト前は 0 が返る (表示中のウィジェットは枠線があり 0 にならない)
      return h ? Math.ceil(h) : null;
    };
    // fill では中身が変わっても body の大きさは変わらず、ラッパーの ResizeObserver が
    // 鳴らない。描画・追加ロード・画像の読み込みを拾ってラッパーに測り直させる。
    // 画像は 1 枚ずつ load が来るので 100ms に 1 回へ間引く
    var contentTimer = 0;
    var notifyContent = function () {
      if (contentTimer) return;
      contentTimer = setTimeout(function () {
        contentTimer = 0;
        document.dispatchEvent(new Event("mn-widget-content"));
      }, 100);
    };
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        // root 自身の style は上の計測とタップ解除が書き換えるだけで、高さは変わらない
        // (拾うと計測 → 変更 → 計測の無限ループになる)
        if (records[i].target === root && records[i].attributeName === "style") continue;
        notifyContent();
        return;
      }
    }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
    // load は bubble しないので capture で拾う (shadow 内のイベントは shadow root を通る)
    shadow.addEventListener("load", notifyContent, true);
  }

  // ---- 幅の診断バー ----
  // 「data-columns を指定したのに1カラムになる」の原因はほぼ設置枠の幅不足だが、
  // 畳まれた理由がどこにも出ないため店舗も運営も特定できない (#1240 / #1242)。
  // 管理画面プレビューでは閾値の周知として、設置先では店舗が URL に
  // ?mnwidget=debug を付けたときだけ、実際の設置場所の幅を出す
  var diagEl = null;
  if (debugMode || (preview && columns)) {
    diagEl = document.createElement("div");
    diagEl.className = "diag";
    shadow.appendChild(diagEl);
  }

  // 幅は描画後・リサイズ後に変わるので、その都度呼び直す
  function updateDiag() {
    if (!diagEl) return;
    var w = root.clientWidth;
    // effectiveColumns の閾値と対にする (2カラム=521px以上 / 3カラム=781px以上)
    var need = columns === 3 ? 781 : 521;
    var eff = columns ? effectiveColumns() : 1;
    // 「画面の幅」と取り違えられるのがこの問い合わせの根なので、測っているものを
    // 名指しする (「枠幅」ではブラウザの枠かウィジェットの枠か読み手に委ねてしまう)
    var head = "設置場所の幅 <b>" + w + "px</b>";
    var html;
    if (!columns) {
      // data-columns 未指定のタイムラインは host に上限幅が掛かるため、実測値は
      // 「置ける幅」ではなく頭打ち後の幅になる。それを設置場所の幅として出すと、広い枠に
      // 置いている店舗が「幅が足りない」と誤解して複数カラムを諦めてしまう。
      // 上限が今まさに効いているかを測って当てにいくと外す (host は Shadow の外の素の
      // div で設置先 CSS に上書きされうるうえ、getComputedStyle は % を px に解決しない)
      // ので、測らずに「カラム未指定なら上限が掛かる」という自分の仕様で言い切る
      // カラムを持たない種類 (出勤状況など) では段数の話をしても混乱するので幅だけ出す
      html = type !== "timeline" ? head
        : "ウィジェットの表示幅 <b>" + w + "px</b> ／ カラム数の指定なし"
          + '<div class="diag-hint">1カラム表示は幅 ' + TL_MAX_WIDTH + "px までに制限されます。"
          + "カラム数を指定すると設置場所の幅いっぱいに広がり、実際の幅が分かります</div>";
    } else if (eff < columns) {
      // 幅を告げるだけでは「ではどうすれば」に答えていないので対処まで書く
      html = head + " ／ " + columns + "カラムには <b>" + need + "px 以上</b>必要です（今は " + eff + "カラム）"
        + '<div class="diag-hint">もっと横幅の広い場所に移すと ' + columns + "カラムになります</div>";
    } else {
      html = head + " ／ " + columns + "カラムで表示中";
    }
    // 「古いコードのまま貼られている」も同じ症状を出す。店舗ではなく問い合わせを
    // 受けた運営がスクショから判別するための行なので、読み飛ばせるよう用途を明示する
    if (debugMode) {
      html += '<div class="diag-src">サポート確認用（読み飛ばして構いません）: ' + esc(script.src) + "</div>";
    }
    diagEl.className = "diag" + (columns && eff < columns ? " ng" : "");
    diagEl.innerHTML = html;
  }
  updateDiag();

  // Cloudflare Image Transformations が落ちた時 (無料枠切れの 429/9422 など) に
  // 変換前の元画像 URL へ 1 回だけ差し戻す。変換が死んでも画像が消えず、重いだけで済む。
  // error は bubble しないのでキャプチャ段で拾う。
  root.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG" || img.getAttribute("data-fallback")) return;
    // https://<domain>/cdn-cgi/image/<options>/<元URL> → <元URL>
    var raw = img.src.replace(/^https:\/\/[^/]+\/cdn-cgi\/image\/[^/]+\//, "");
    // R2 のサムネイル (issue #1772): https://<media>/thumbs/v1/w<幅>/<元のキー>.webp → https://<media>/<元のキー>
    if (raw === img.src) raw = img.src.replace(/^(https:\/\/[^/]+\/)thumbs\/v1\/w\d+\/(.+)\.webp$/, "$1$2");
    if (raw === img.src || raw.indexOf("https://") !== 0) return;
    img.setAttribute("data-fallback", "1");
    img.src = raw;
  }, true);

  // SVG アイコン
  var svgUser = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + colors.fnt + '" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var svgHeart = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  function svgClock(c) {
    return '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  }
  var svgPin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  var svgBolt = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  // スタッフカード左上の出勤ステータスバッジ (フロント therapist_grid.html と同等)
  function staffBadge(it) {
    if (it.status === "available")
      return '<span class="staff-badge" style="background:' + accent + '">' + svgBolt + '今すぐ</span>';
    if (it.status === "on_duty")
      return '<span class="staff-badge duty"><span class="dot"></span>出勤中</span>';
    if (it.status === "scheduled")
      return '<span class="staff-badge sched code">' + esc(it.schedule_start || "") + '〜</span>';
    if (it.status === "finished")
      return '<span class="staff-badge fin">退勤済</span>';
    return "";
  }
  var svgX = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  var svgBluesky = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.479 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/></svg>';
  var endMarkup = '<div class="tl-end"><div class="tl-end-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div class="tl-end-text">すべての投稿を表示しました</div></div>';

  // 時間フォーマット
  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso), now = new Date(), m = Math.floor((now - d) / 60000);
    if (m < 1) return "たった今";
    if (m < 60) return m + "分前";
    if (m < 1440) return Math.floor(m / 60) + "時間前";
    var y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "昨日";
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  // innerHTML への埋め込み前エスケープ。textContent 経由では属性値のクォートが
  // 残るため、属性に差す用途 (src / href) も想定して明示的に潰す
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // タイムライン1カードの HTML を組み立て (accent はクロージャ参照)
  function renderTimelineCard(it, i) {
    var delay = "animation-delay:" + ((i % pageSize) * 0.05) + "s";
    var cardStyle = delay;
    if (it.today_schedule) cardStyle += ";border-left:2px solid " + accent + "66";
    var html = '<div class="tl-card" style="' + cardStyle + '">';

    /* ヘッダー */
    html += '<div class="tl-hdr">';
    var avShape = it.is_store_post ? "square" : "circle";
    html += '<div class="tl-av-wrap">';
    if (it.author_image) html += '<img class="tl-av ' + avShape + '" src="' + esc(safeUrl(it.author_image)) + '">';
    else html += '<div class="tl-av-ph ' + avShape + '">' + esc((it.author || "S").charAt(0)) + '</div>';
    if (it.is_on_duty_now) html += '<span class="tl-duty-dot"></span>';
    html += '</div>';

    /* メタ */
    html += '<div class="tl-meta">';
    html += '<div class="tl-meta-row">';
    html += '<span class="tl-author">' + esc(it.author || "") + '</span>';
    html += '<span class="tl-sep">·</span>';
    html += '<span class="tl-time code">' + fmtTime(it.created_at) + '</span>';
    if (it.source_platform === "x") html += '<span class="tl-src x" title="X 由来">' + svgX + '</span>';
    else if (it.source_platform === "bluesky") html += '<span class="tl-src bluesky" title="Bluesky 由来">' + svgBluesky + '</span>';
    html += '</div>';
    // feed_card.html と同じ: セラピスト投稿 → 所属店舗名、店舗投稿 → 都道府県 ・ エリア
    var sub = it.store_name || it.area_label;
    if (sub) html += '<div class="tl-sub">' + esc(sub) + '</div>';
    if (it.today_schedule) {
      var schedCls = it.is_on_duty_now ? "on" : "off";
      var iconColor = it.is_on_duty_now ? "#10b981" : colors.mut;
      html += '<div class="tl-sched ' + schedCls + ' code">' + svgClock(iconColor)
            + '<span>本日 ' + esc(it.today_schedule.start) + '〜' + esc(it.today_schedule.end)
            + (it.is_on_duty_now ? ' 出勤中' : '') + '</span></div>';
    }
    html += '</div>';

    /* 今すぐ可 バッジ */
    if (it.is_on_duty_now && it.instant_booking) {
      html += '<span class="tl-instant" style="background:' + accent + '">' + svgBolt + '今すぐ可</span>';
    }
    html += '</div>'; /* /tl-hdr */

    /* 本文 (200 字超は 140 字 + 「さらに表示」で折り畳み) */
    if (it.content) {
      var chars = Array.from(it.content);
      if (chars.length > 200) {
        html += '<div class="tl-body">'
              + '<span class="tl-text">' + esc(chars.slice(0, 140).join("")) + '</span>'
              + '<button class="tl-more" type="button">さらに表示</button>'
              + '<span class="tl-text-full" hidden>' + esc(it.content) + '</span>'
              + '</div>';
      } else {
        html += '<div class="tl-body">' + esc(it.content) + '</div>';
      }
    }

    /* 画像 (X 風 4 通り) */
    if (it.images && it.images.length) {
      var n = Math.min(it.images.length, 4);
      html += '<div class="tl-imgs"><div class="tl-imgs-grid c' + n + '">';
      it.images.slice(0, 4).forEach(function (img) {
        html += '<img data-src="' + esc(safeUrl(img)) + '" alt="">';
      });
      html += '</div></div>';
    }

    /* いいね */
    if (it.like_count > 0) html += '<div class="tl-likes">' + svgHeart + '<span class="code">' + it.like_count + '</span></div>';

    html += '</div>'; /* /tl-card */
    return html;
  }

  // スクロール容器内では loading="lazy" がビューポート (画面全体) 基準で誤作動し、
  // max-height のスクロール領域内の全画像が一斉に読み込まれてしまう。
  // 容器自身を root にした IntersectionObserver で、本当に近づいた画像だけ data-src → src する。
  function observeLazyImages(scope) {
    if (!bodyEl) return;
    var imgs = scope.querySelectorAll("img[data-src]");
    if (!imgs.length) return;
    if (!("IntersectionObserver" in window)) {
      // 非対応ブラウザは即時読み込みにフォールバック
      imgs.forEach(function (img) { img.src = img.dataset.src; img.removeAttribute("data-src"); });
      return;
    }
    if (!imgObserver) {
      // data-height="auto" は .root がスクロールせず全体が clip 領域に入ってしまうため、
      // 画像の遅延判定はページのビューポート基準 (root: null) に切り替える
      imgObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var img = e.target;
          if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
          imgObserver.unobserve(img);
        });
      }, { root: heightMode === "auto" ? null : root, rootMargin: "200px" });
    }
    imgs.forEach(function (img) { imgObserver.observe(img); });
  }

  // ---- 段組み (data-columns) の配置 ----
  // グリッドではなく段ごとの縦積みにして、新しいカードを常に一番低い段へ入れる。
  // 既存カードは動かさないので、無限スクロールで追記しても表示中のカードが飛ばない。
  var tlCards = [];   // 追加順のカード要素 (段数が変わったときの再配置に使う)
  var colWrap = null; // .tl-cols
  var colEls = [];
  var colCount = 0;

  // 段数はビューポートではなくウィジェット自身の幅で決める
  // (サイドバーなど狭い枠に置かれた場合も正しく畳まれる)
  function effectiveColumns() {
    var w = root.clientWidth;
    if (w <= 520) return 1;
    if (w <= 780) return Math.min(columns, 2);
    return columns;
  }

  function placeCards(cards) {
    cards.forEach(function (card) {
      var idx = 0, min = Infinity;
      for (var i = 0; i < colEls.length; i++) {
        // 直前に入れたカードの高さを含めたいので都度実測する
        var h = colEls[i].offsetHeight;
        if (h < min) { min = h; idx = i; }
      }
      colEls[idx].appendChild(card);
    });
  }

  // 段数が変わったときだけ段を作り直して全カードを再配置する。作り直したら true
  function packColumns() {
    if (!columns || !bodyEl) return false;
    var n = effectiveColumns();
    if (colWrap && n === colCount) return false;
    colCount = n;
    var prev = colWrap;
    colWrap = document.createElement("div");
    colWrap.className = "tl-cols";
    colEls = [];
    for (var i = 0; i < n; i++) {
      var c = document.createElement("div");
      c.className = "tl-col";
      colWrap.appendChild(c);
      colEls.push(c);
    }
    // ローダー / 終端表示は段の外 (下) に残すため先頭に差し込む
    bodyEl.insertBefore(colWrap, bodyEl.firstChild);
    // 旧ラッパーを残すと空の段が幅を食うので必ず外す
    // (カードは tlCards が参照を保持しているので placeCards で貼り直せる)
    if (prev) prev.remove();
    placeCards(tlCards);
    return true;
  }

  // 「さらに表示」クリックハンドラ束ね
  function bindMoreButtons(scope) {
    scope.querySelectorAll(".tl-more").forEach(function (btn) {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        var parent = btn.parentElement;
        var full = parent.querySelector(".tl-text-full");
        parent.querySelector(".tl-text").textContent = full.textContent;
        full.remove();
        btn.remove();
      });
    });
  }

  // 次ページを取得して append
  function loadMore() {
    if (isLoading || !hasMore || type !== "timeline" || !bodyEl) return;
    isLoading = true;
    fetch(buildApiUrl(currentOffset)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      var items = data.items || [];
      hasMore = !!data.has_more;
      var html = "";
      items.forEach(function (it, j) { html += renderTimelineCard(it, currentOffset + j); });
      currentOffset += items.length;
      var loader = bodyEl.querySelector(".tl-loader");
      if (loader) loader.remove();
      if (columns) {
        var tmp = document.createElement("div");
        tmp.innerHTML = html;
        var fresh = [].slice.call(tmp.querySelectorAll(".tl-card"));
        tlCards = tlCards.concat(fresh);
        // 段を作り直した場合は tlCards 全件を配置済みなので二重に置かない
        if (!packColumns()) placeCards(fresh);
      } else {
        bodyEl.insertAdjacentHTML("beforeend", html);
      }
      if (hasMore) {
        bodyEl.insertAdjacentHTML("beforeend", '<div class="tl-loader"><div class="spinner"></div></div>');
      } else {
        bodyEl.insertAdjacentHTML("beforeend", endMarkup);
      }
      bindMoreButtons(bodyEl);
      observeLazyImages(bodyEl);
      isLoading = false;
    }).catch(function (e) {
      console.error("[MN Widget] loadMore", e);
      // 閲覧中に店舗/グループが非公開化されると以降は 404 が続くため打ち切る (再フェッチ連打防止)
      if (/HTTP 404/.test(String(e && e.message))) hasMore = false;
      // ローダーを除去しないとスクロール時に再 fetch がトリガされても表示が二重になる
      var loader = bodyEl.querySelector(".tl-loader");
      if (loader) loader.remove();
      isLoading = false;
    });
  }

  // ---- スマホのタップ解除 (data-touch-lock, issue #1400) ----
  // 設置先のスマホ表示でウィジェットが画面幅の大半を占めると、ページを下に送ろうとして
  // 指が乗るたびに枠内スクロール (.root の overflow-y:auto + overscroll-behavior:contain) に
  // 取られて先へ進めない。Google Maps の「タップして操作」と同じく、タップするまで枠内
  // スクロールを止めてタッチをページ側へ素通しにする。
  // ロック中は .root の overflow と overscroll-behavior を差し替えるだけ (ユーザー操作では
  // 動かないが sticky や scrollTop はそのまま) なので、ページングやCTA のロジックには
  // 手を入れない
  var svgTouchHand = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5a1.5 1.5 0 0 1 3 0V12"/><path d="M15 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.8-2.4l-2.6-3.5a1.6 1.6 0 0 1 2.4-2.1L9 16"/></svg>';
  function setupTouchLock() {
    // 枠内に閉じたスクロールが無い設置では止めるものが無い
    if (!touchLock || heightMode === "auto" || type === "featured" || type === "oshikome") return;
    // マウス環境ではポインタを枠の外に置けるので問題自体が起きない。ホバーできる
    // ポインタを持つ端末 (iPad + トラックパッド / マウス接続の Android / 2-in-1 の
    // タブレットモード) は pointer:coarse を名乗るが、ホイールで枠内を読めるうえ
    // 「タップして」の文言も合わないので hover:none と併せて絞る
    if (!window.matchMedia || !window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    var pill = document.createElement("div");
    pill.className = "tlock";
    // スクリーンリーダーは overflow:hidden の中身も scrollIntoView で読めてしまい
    // ロック自体が効かないので、案内だけ読み上げても混乱させる
    pill.setAttribute("aria-hidden", "true");
    pill.innerHTML = '<span class="tlock-btn">' + svgTouchHand + "タップしてスクロール</span>";
    shadow.appendChild(pill);

    // fill は inline で overflow-y:auto を持つので、戻し先は「今の inline 値」(通常は空 = CSS に戻る)
    var savedOverflow = root.style.overflowY;
    var locked = false;

    // 枠内に読み進める先が無ければピルを出さない (押しても何も動かないボタンになる)。
    // 画像の遅延読み込みや追加ロードで後から溢れるので、中身の変化に追従させる
    function canScroll() { return root.scrollHeight - root.clientHeight > 4; }
    // ピルは予約CTA の上に逃がす。CTA の高さは受付時間の注記やデモ表示の有無で変わるので、
    // 定数で持たずに実測する (cta.url を持たない電話CTA も querySelector なら拾える)
    function syncPill() {
      var show = locked && canScroll();
      // 選択ドラッグの袋小路を断つのは、読み進める先があってスクロールを止めている
      // ときだけ。中身が枠に収まる店で切ったままにすると、本文 (電話番号・源氏名) を
      // 長押しでコピーできない状態が解除不能のまま残る
      root.style.userSelect = show ? "none" : "";
      root.style.webkitUserSelect = show ? "none" : "";
      if (!show) { pill.style.display = "none"; return; }
      var cta = root.querySelector(".cta");
      // ピルは host 基準の絶対配置だが、host には .root の下に診断バーがぶら下がることが
      // ある。host の下端から測ると診断バーのぶん下がって予約CTA に乗るので、
      // .root の下端までの差分を足し戻す
      var below = host.getBoundingClientRect().bottom - root.getBoundingClientRect().bottom;
      pill.style.bottom = (below + (cta ? cta.offsetHeight : 0) + 12) + "px";
      pill.style.display = "flex";
    }
    // rewind = 先頭に戻してからロックする。ウィジェットが画面外へ出た = 読み終えて
    // 次へ進んだということなので、次に目に入るときは最新の投稿から見せる
    // (末尾まで読んだ位置で固まると、店舗トップに「投稿は以上です」の板が residual に
    //  残り続ける)。枠外タッチでの再ロックは近くで読み続けている途中なので戻さない
    function lock(rewind) {
      if (locked) {
        if (rewind) root.scrollTop = 0;
        return;
      }
      locked = true;
      if (rewind) root.scrollTop = 0;
      root.style.overflowY = "hidden";
      // ロック中の .root は「ユーザーが動かせないスクロール容器」= 常に境界にいる状態。
      // ここに overscroll-behavior:contain が残ると指の動きがページ側へ伝わらず、
      // 直そうとしている袋小路そのものになる (Chrome 144 以降は overflow:hidden の
      // 容器でも overscroll-behavior を尊重するため、既定の script タグ設置で必ず踏む)
      root.style.overscrollBehavior = "auto";
      // ロック中に長押しから始まるドラッグでテキスト選択に入ると、選択ハンドルの操作に
      // なってページも枠内も動かない袋小路ができる (解除の click も出ない)。
      // user-select を切るのは syncPill 側 (ピルを出す = 止める価値がある場合のみ)。
      // syncPill は scrollHeight / offsetHeight を読む = 同期レイアウトが走る。
      // ロック済みなら上で return するので、これが走るのは解除→再ロックの 1 周期に
      // 1 回だけ。設置先のスクロール中に毎回走るわけではないので同期のままでよい
      syncPill();
    }
    function unlock() {
      if (!locked) return;
      locked = false;
      pill.style.display = "none";
      root.style.userSelect = "";
      root.style.webkitUserSelect = "";
      root.style.overflowY = savedOverflow;
      // 枠内の終端まで読んだらそのまま指でページ側へ抜けられるようにする。contain のままだと
      // 枠の外を触るまで先へ進めず、解除前と同じ袋小路になる
      root.style.overscrollBehavior = "auto";
    }

    var onDocTouch = function (e) {
      // 枠の外を触った = ページを動かす意図。次に指が乗ったときに取られないよう戻す。
      // Shadow 内で起きたタッチは host に retarget されるので contains で内外が分かる。
      // iframe 版では親ページのタッチが届かないため、下の IntersectionObserver が代わりを務める
      if (!host.isConnected) return dispose();
      // 予約オーバーレイは body 直下に挿さるので枠の外に見えるが、触っているのは
      // このウィジェットの中身。閉じた直後にタップを 1 回損するだけなので除外する
      if (overlayHost && overlayHost.contains(e.target)) return;
      if (!host.contains(e.target)) lock();
    };
    var io = null;
    var ro = null;
    // ホストごと差し替えられる設置 (管理画面プレビューは設定を変えるたびに作り直す) で、
    // document リスナーと Observer を残さない。featured の dispose() と同じ後始末
    function dispose() {
      document.removeEventListener("touchstart", onDocTouch);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
    }
    // ロック中のタップは解除に使う。止めているのはスクロールだけ (ピルの文言も
    // 「タップしてスクロール」) なので、タップはどこに当たってもそのまま通す。
    // 枠外を触るたびに再ロックする以上ここでタップを奪うと、予約が毎回 2 タップ必要に
    // なって CTA の計測も取りこぼす。奪う価値も無い: ウィジェット内の操作先は予約CTA と
    // 「さらに表示」だけで、どちらも通すべき相手だし、それ以外の場所には既定動作が無い。
    // stopPropagation に至っては設置先ページの委譲ハンドラ (「外側クリックで閉じる」系) を
    // 巻き込むだけの副作用になる。
    // 読み進める先が無いとき (= ピルを出していないとき) は解除する意味が無いので何もしない
    root.addEventListener("click", function () {
      if (!locked || !canScroll()) return;
      unlock();
    }, true);
    // ピル本体は自分でタップを受ける (.tlock-btn は pointer-events:auto)。
    // .root の外に居るので上のリスナーには届かない
    pill.addEventListener("click", unlock);
    document.addEventListener("touchstart", onDocTouch, { passive: true });
    // 画面外に出たら戻す。iframe 内でも親ビューポート基準で判定される
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (entries) {
        if (!host.isConnected) return dispose();
        var last = entries[entries.length - 1];
        if (last.isIntersecting) return;
        // 先頭に戻すのは「スクロールして通り過ぎた」ときだけ。タブ・アコーディオンで
        // display:none にされた場合は読んでいる途中なので、位置を消さない
        var box = last.boundingClientRect;
        lock(box.width > 0 && box.height > 0);
      }, { threshold: 0 });
      io.observe(host);
    }
    // 追加ロードや画像読み込みで中身が伸びたらピルの要否と位置を測り直す。
    // ResizeObserver の無い端末 (旧 iOS Safari) でも初回測定が遅延読み込み前の
    // 高さで固まらないよう、embed.html の高さ通知と同じ間隔で測り直す
    if ("ResizeObserver" in window && bodyEl) {
      ro = new ResizeObserver(function () {
        if (!host.isConnected) return dispose();
        syncPill();
      });
      ro.observe(bodyEl);
      // .cta は bodyEl の兄弟なので別に観測する。フォント差し替えで受付時間の注記が
      // 2 行になる等で CTA だけが伸びると、ピルが予約ボタンの上に乗ったままになる
      var ctaEl = root.querySelector(".cta");
      if (ctaEl) ro.observe(ctaEl);
    } else {
      [300, 1000, 2500].forEach(function (ms) {
        setTimeout(function () {
          // ResizeObserver が無い経路では IntersectionObserver も外れた host には
          // 通知を出さないので、後始末の当たり所がここしか残らない
          if (!host.isConnected) return dispose();
          syncPill();
        }, ms);
      });
    }
    lock();
  }

  function setupInfiniteScroll() {
    if (type !== "timeline" || !bodyEl) return;
    // data-height="auto" は内部スクロールを持たないため追加ロードのトリガが無い (全件展開済み)
    if (heightMode === "auto") return;
    // スクロール容器は .root。requestAnimationFrame で scroll 連発を間引く
    var ticking = false;
    root.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 100) loadMore();
        ticking = false;
      });
    });
  }

  // ---- 大バナー (type=featured, issue #1166) のカルーセル ----
  // 状態は「どのカードが中央か」の index 1つ。カードの .pos-c/.pos-l/.pos-r を
  // 付け替えるだけで CSS transition が回転アニメーションを作る (1〜2枚でも mod で破綻しない)
  function bindFeatured(scope) {
    var stage = scope.querySelector(".ft-stage");
    if (!stage) return;
    var cards = [].slice.call(stage.querySelectorAll(".ft-card"));
    var n = cards.length;
    if (n < 2) return; // 1枚は回すものがない (矢印も描いていない)
    var idx = 0;
    function apply() {
      cards.forEach(function (card, i) {
        var off = (i - idx + n) % n;
        card.className = "ft-card " + (off === 0 ? "pos-c" : off === 1 && n === 3 ? "pos-l" : "pos-r");
      });
    }
    // 手動操作も自動送りもここを通す。自分で送った時点で「見たい子を選んだ」
    // 意図が出ているので、以後は自動送りを止めて選んだカードを残す。
    // タッチ端末はホバーで止められないため、これが唯一の停止手段でもある
    function go(step) {
      idx = (idx + step + n) % n;
      apply();
      manual = true;
      stop();
    }

    // ---- 自動送り ----
    // 設置先の他人のサイトで回り続けるものなので、見えていない間は止める:
    // 画面外 (IntersectionObserver) / 裏タブ (visibilitychange) / ホバー中。
    // アニメーションを減らす設定の環境では自動では動かさない (操作は従来どおり可能)
    // カード切替のトランジションが 0.45s あるので、静止して読める時間が残る 3s にする
    var AUTO_MS = 3000;
    var timer = null, visible = false, manual = false;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var paused = false;
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() {
      stop();
      if (manual || reduce || paused || !visible || document.hidden) return;
      timer = setInterval(function () {
        // 後始末は IntersectionObserver の通知頼みにしない。通知が来ない経路で
        // 分離済みの DOM を回し続けないよう、tick 自身でも生存を確認する
        if (!host.isConnected) return dispose();
        idx = (idx + 1) % n;
        apply();
      }, AUTO_MS);
    }
    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (entries) {
        visible = entries.some(function (e) { return e.isIntersecting; });
        // ホストごと差し替えられたら (管理画面プレビューは保存のたびに作り直す)
        // 後始末してタイマーとリスナーを残さない
        if (!host.isConnected) return dispose();
        restart();
      }, { threshold: 0.35 });
      io.observe(stage);
    } else {
      visible = true;
      restart();
    }
    function dispose() {
      stop();
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    }
    function onVisibility() {
      if (!host.isConnected) return dispose();
      restart();
    }
    document.addEventListener("visibilitychange", onVisibility);

    // スワイプ直後に合成 click が飛ぶ端末があるので、直前がスワイプなら click を無視する。
    // 矢印を素通しにすると「スワイプで1枚 + 合成clickで1枚」で2枚送られ、
    // リンクを素通しにするとスワイプしただけで店舗ページへ飛ぶ。
    // 経過時間で判定するのは、click が来ない端末でフラグが残り、
    // 次のマウス操作 (タッチ非経由なので touchstart で解除されない) を食わないようにするため
    var swipedAt = 0;
    function justSwiped() { return Date.now() - swipedAt < 500; }

    scope.querySelectorAll(".ft-nav").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (justSwiped()) return;
        go(btn.className.indexOf("prev") !== -1 ? -1 : 1);
      });
    });

    var wrap = scope.querySelector(".ft-wrap");
    var link = scope.querySelector(".ft-link");
    // 読んでいる最中に送られないよう、ポインタが乗っている間は止める。
    // タッチ端末ではタップ後にエミュレートの mouseenter だけが飛び、指を離しても
    // mouseleave が来ないため、hover を持つ環境に限る (でないと一度触ると二度と再開しない)
    if (!window.matchMedia || window.matchMedia("(hover: hover)").matches) {
      wrap.addEventListener("mouseenter", function () { paused = true; stop(); });
      wrap.addEventListener("mouseleave", function () { paused = false; restart(); });
    }
    var sx = 0, sy = 0;
    wrap.addEventListener("touchstart", function (e) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; swipedAt = 0;
    }, { passive: true });
    wrap.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        swipedAt = Date.now();
        go(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
    if (link) link.addEventListener("click", function (e) { if (justSwiped()) e.preventDefault(); });
  }

  // ---- 予約CTA (issue #794) ----
  // 表示可否・遷移先はすべてサーバ (widget_shop_data の cta) が決める。
  // ここは描画とオーバーレイの開閉だけを持つ。

  var svgCal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
  var svgPhone = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  // 行末のシェブロン。「押すと先がある」ことを主張しすぎずに示す
  var svgChevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

  // セラピストヘッダー (名前・出勤ステータス・本日の出勤時間)
  function renderTherapistHeader(t) {
    if (!t || !t.name) return "";
    var html = '<div class="thdr">';
    if (t.image) html += '<img class="thdr-av" src="' + esc(safeUrl(t.image)) + '" alt="">';
    else html += '<div class="thdr-ph">' + esc(t.name.charAt(0)) + '</div>';
    html += '<div class="thdr-main"><div class="thdr-name">' + esc(t.name) + '</div>';
    var sub = "";
    if (t.start_time && t.end_time) {
      sub = svgClock("currentColor") + '<span class="code">本日 ' + esc(t.start_time) + '〜' + esc(t.end_time) + '</span>';
    }
    if (sub) html += '<div class="thdr-sub">' + sub + '</div>';
    html += '</div>';
    // バッジはスタッフ一覧と同じ判定・同じ見た目を使う (表示の乖離を作らない)
    return html + staffBadge(t) + '</div>';
  }

  // 週間スケジュール (1日1行)。schedule 型と投稿0件のプロフィール (issue #1641) で共用
  function renderScheduleList(days) {
    var html = '<div class="sch-list">';
    days.forEach(function (it, i) {
      var rowStyle = "animation-delay:" + (i * 0.04) + "s";
      if (it.is_today) rowStyle += ";border-left-color:" + accent + ";background:" + accent + "14";
      html += '<div class="sch-row' + (it.is_today ? " today" : "") + (it.working ? "" : " off") + '" style="' + rowStyle + '">';
      html += '<div class="sch-date">';
      if (it.is_today) html += '<span class="sch-today" style="background:' + accent + '">今日</span>';
      html += '<span class="sch-d">' + esc(it.date) + '</span>';
      html += '<span class="sch-wd">(' + esc(it.weekday) + ')</span>';
      html += '</div>';
      if (it.working) {
        html += '<div class="sch-on">';
        html += '<span class="sch-pill"><span class="sch-dot"></span>出勤</span>';
        html += '<span class="sch-time code">' + esc(it.start_time) + '〜' + esc(it.end_time) + '</span>';
        html += '</div>';
      } else {
        html += '<span class="sch-rest">休</span>';
      }
      html += '</div>';
    });
    return html + '</div>';
  }

  // 投稿0件のセラピストのプロフィール (issue #1641)。iframe 版は高さ固定なので、
  // 「投稿はまだありません」だけだと枠の大半が空箱になる。サーバが載せたものだけ描く
  function renderTherapistProfile(p) {
    var html = '<div class="pf"><p class="pf-note">投稿はまだありません</p>';
    if (p.images && p.images.length) {
      html += '<div class="pf-imgs">';
      p.images.forEach(function (url, i) {
        html += '<div class="media-card" style="animation-delay:' + (i * 0.04) + 's"><img data-src="' + esc(safeUrl(url)) + '" alt=""></div>';
      });
      html += '</div>';
    }
    if (p.schedule && p.schedule.length) {
      html += '<section><h3 class="pf-h">今週の出勤</h3>' + renderScheduleList(p.schedule) + '</section>';
    }
    if (p.description) {
      // タイムライン本文と同じ畳み方 (200 字超は 140 字 + 「さらに表示」。bindMoreButtons が開く)
      var chars = Array.from(p.description);
      html += '<section><h3 class="pf-h">プロフィール</h3><div class="pf-desc">';
      if (chars.length > 200) {
        html += '<span class="tl-text">' + esc(chars.slice(0, 140).join("")) + '</span>'
              + '<button class="tl-more" type="button">さらに表示</button>'
              + '<span class="tl-text-full" hidden>' + esc(p.description) + '</span>';
      } else {
        html += esc(p.description);
      }
      html += '</div></section>';
    }
    if (p.oshikome && p.oshikome.items && p.oshikome.items.length) {
      html += '<section><h3 class="pf-h">推しコメ<span class="pf-count">' + esc(String(p.oshikome.total)) + '件</span></h3>';
      p.oshikome.items.forEach(function (r) {
        html += '<div class="pf-ok"><p class="pf-ok-body">' + esc(r.comment) + '</p><div class="pf-ok-meta">';
        (r.tags || []).forEach(function (t) { html += '<span class="pf-ok-tag">' + esc(t) + '</span>'; });
        html += '<span class="pf-ok-date">' + esc(r.date_label) + '</span></div></div>';
      });
      html += '</section>';
    }
    return html + '</div>';
  }

  // CTA 本体。cta が無ければ空文字（＝サーバが「出さない」と判断した状態）
  function renderCta(cta) {
    if (!cta || !cta.mode) return "";
    // 店舗カラーは面ではなくアイコンと矢印にだけ乗せる (設置先サイトから浮かせない)
    var label = esc(cta.label || "予約する");
    var accentStyle = ' style="color:' + accent + '"';
    var icon = '<span class="cta-ico"' + accentStyle + ">" + (cta.mode === "tel" ? svgPhone : svgCal) + "</span>";
    var arrow = '<span class="cta-arrow"' + accentStyle + ">" + svgChevron + "</span>";
    var body = icon + label + arrow;
    var inner;
    if (cta.mode === "tel") {
      inner = '<a class="cta-btn" href="tel:' + esc(cta.tel || "") + '" data-cta="tel">' + body + "</a>";
    } else if (cta.mode === "external") {
      inner = '<a class="cta-btn" href="' + esc(safeUrl(cta.url)) + '" target="_blank" rel="noopener nofollow" data-cta="external">' + body + "</a>";
    } else {
      // booking_pick は宛先未定の面 (店舗単位) 用。押した先で相手を選ばせてから開く
      var act = cta.mode === "booking_pick" ? "booking_pick" : "booking";
      inner = '<button type="button" class="cta-btn" data-cta="' + act + '">' + body + "</button>";
    }
    var hint = cta.phone_hint ? '<div class="cta-hint">' + esc(cta.phone_hint) + '</div>' : "";
    // cta.preview はサーバが「設定 OFF のままプレビューしている」と判断したときだけ返す
    var demo = cta.preview ? '<div class="cta-demo">デモ表示 — 設定を ON にすると公開されます</div>' : "";
    return '<div class="cta">' + inner + hint + demo + '</div>';
  }

  // 大バナー用の予約ボタン (issue #1445)。共通の .cta ピルと違い、バナーの導線行に
  // 並べるので見た目はバナー側に合わせる。押した後の処理は bindCta が共通で持つ
  function renderFeaturedCta(cta) {
    if (!cta || !cta.mode) return "";
    var body = '<span class="ft-book-ic">' + (cta.mode === "tel" ? svgPhone : svgCal) + "</span>"
             + esc(cta.label || "予約する");
    if (cta.mode === "tel") {
      return '<a class="ft-book" href="tel:' + esc(cta.tel || "") + '" data-cta="tel">' + body + "</a>";
    }
    if (cta.mode === "external") {
      return '<a class="ft-book" href="' + esc(safeUrl(cta.url)) + '" target="_blank" rel="noopener nofollow" data-cta="external">'
           + body + "</a>";
    }
    var act = cta.mode === "booking_pick" ? "booking_pick" : "booking";
    return '<button type="button" class="ft-book" data-cta="' + act + '">' + body + "</button>";
  }

  // タップ計測。設置先に計測タグを入れない代わりにサーバへビーコンを送る
  function reportCtaClick(mode) {
    try {
      var url = base + "/widget/api/cta-click/" + encodeURIComponent(storePuid) + "/?mode=" + encodeURIComponent(mode)
              + (therapistPuid ? "&therapist=" + encodeURIComponent(therapistPuid) : "");
      if (navigator.sendBeacon) navigator.sendBeacon(url);
      else fetch(url, { method: "POST", mode: "no-cors", keepalive: true });
    } catch (_) {}
  }

  // 予約オーバーレイ。設置先 HP の DOM に影響されないよう、ウィジェット本体とは
  // 別の host + shadow root を document.body 直下に挿す。
  // (本体は overflow:auto の箱なのでモーダルが閉じ込められる。また設置先に
  //  transform を持つ祖先があると position:fixed が壊れる)
  var overlayHost = null;
  var savedOverflow = null;
  var overlayFrame = null;
  var overlayReady = null;   // 起動通知を受けたときに呼ぶ (投稿フォームのオーバーレイのみ)
  var overlayTimer = null;
  function closeOverlay() {
    if (!overlayHost) return;
    clearTimeout(overlayTimer);
    overlayReady = null;
    overlayFrame = null;
    overlayHost.remove();
    overlayHost = null;
    // 設置先 HP が自前で overflow を指定している可能性があるので元の値へ戻す
    if (savedOverflow) {
      document.documentElement.style.overflow = savedOverflow.html;
      document.body.style.overflow = savedOverflow.body;
      savedOverflow = null;
    }
  }
  // fallbackLabel を渡すと、iframe から起動通知 (compose-ready) が届かないときに
  // 同じ URL を新しいタブで開くリンクへ切り替える (issue #1485)。設置先の CSP
  // (frame-src) がポータルを禁じていると iframe は無言で空になり、JS からは検知できない。
  // 新しいタブなら frame-src の対象外で、Turnstile もポータル自身のホスト名で通る
  function openOverlay(url, title, fallbackLabel) {
    if (overlayHost) return;
    overlayHost = document.createElement("div");
    var ov = overlayHost.attachShadow({ mode: "closed" });
    var ovStyle = document.createElement("style");
    ovStyle.textContent = [
      ".bg{" + RESET + "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center}",
      ".panel{position:relative;width:100%;height:100%;background:" + colors.bg + ";overflow:hidden}",
      "@media(min-width:640px){.panel{width:420px;height:min(720px,90vh);border-radius:20px;box-shadow:0 24px 60px -12px rgba(0,0,0,.5)}}",
      ".frame{width:100%;height:100%;border:0;display:block}",
      ".fb{display:none;height:100%;box-sizing:border-box;padding:56px 24px 32px;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;font-size:13px;line-height:1.7;color:" + colors.txt + "}",
      ".fb a{display:inline-block;padding:12px 22px;border-radius:999px;background:#f53d7b;color:#fff;font-weight:700;font-size:14px;text-decoration:none}",
      ".panel.blocked .frame{display:none}",
      ".panel.blocked .fb{display:flex}",
      ".x{position:absolute;top:10px;right:10px;z-index:2;width:32px;height:32px;border:0;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;font:inherit;font-size:18px;line-height:1;cursor:pointer}",
    ].join("\n");
    ov.appendChild(ovStyle);

    var bg = document.createElement("div");
    bg.className = "bg";
    bg.innerHTML = '<div class="panel"><button type="button" class="x" aria-label="閉じる">×</button>'
                 + '<iframe class="frame" src="' + esc(safeUrl(url)) + '" title="' + esc(title || "WEB予約") + '" allow="clipboard-write"></iframe>'
                 + (fallbackLabel
                   ? '<div class="fb"><p>このページでは入力画面を表示できませんでした。<br>メンエスなうのページで続けられます。</p>'
                     + '<a href="' + esc(safeUrl(url)) + '" target="_blank" rel="noopener">' + esc(fallbackLabel) + '</a></div>'
                   : "")
                 + '</div>';
    ov.appendChild(bg);
    overlayFrame = bg.querySelector(".frame");
    if (fallbackLabel) {
      var panel = bg.querySelector(".panel");
      overlayTimer = setTimeout(function () { panel.classList.add("blocked"); }, OK_COMPOSE_READY_TIMEOUT);
      // 回線が遅いだけで後から届くこともあるので、そのときは iframe に戻す
      overlayReady = function () { clearTimeout(overlayTimer); panel.classList.remove("blocked"); };
      bg.querySelector(".fb a").addEventListener("click", closeOverlay);
    }
    document.body.appendChild(overlayHost);
    savedOverflow = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    bg.querySelector(".x").addEventListener("click", closeOverlay);
    // 投稿フォームは背景クリックで閉じない。PC で枠の外を誤クリックすると、
    // 書きかけのコメントが iframe ごと消えて戻せない (閉じるのは × だけ)
    if (!fallbackLabel) bg.addEventListener("click", function (e) { if (e.target === bg) closeOverlay(); });
  }

  // iframe (同一オリジンの予約ページ) からの通知。origin を必ず検証する
  window.addEventListener("message", function (e) {
    // 送信元は origin か「自分が開いた iframe」で確かめる。手書きタグの src が www 付きや
    // http だと iframe はリダイレクト後の正規オリジンになり、base と一致しなくなる
    // (扱うのは開閉の通知だけで、中身を信用する処理は無い)
    if (!overlayHost || (e.origin !== base && e.source !== overlayFrame.contentWindow)) return;
    var d = e.data;
    if (!d) return;
    if (d.type === "mn-booking" && d.event === "close") closeOverlay();
    // 投稿フォーム単体モード (okCompose) の閉じる操作
    if (d.type === "mn-widget" && d.event === "compose-close") closeOverlay();
    if (d.type === "mn-widget" && d.event === "compose-ready" && overlayReady) overlayReady();
  });

  function bindCta(scope) {
    var btn = scope.querySelector("[data-cta]");
    if (!btn) return;
    var mode = btn.getAttribute("data-cta");
    btn.addEventListener("click", function () {
      // プレビューのタップは実績ではないので数えない。
      // booking_pick は宛先を選ぶ 1 段が挟まるので、ここでは数えず
      // 実際に予約フォームを開く okBookGo で数える (booking と意味を揃える)
      if (!preview && mode !== "booking_pick") reportCtaClick(mode);
      if (mode === "booking") {
        // 設置元ホストは計測用、theme はウィジェットと見た目を揃えるため
        openBooking(base + ctaUrl + ctaSep() + "theme=" + (dark ? "dark" : "light")
                    + "&host=" + encodeURIComponent(location.host)
                    + (preview ? "&preview=1" : ""));
      } else if (mode === "booking_pick") {
        // 宛先を選ばせてから同じオーバーレイを開く (推しコメウィジェットのみ)
        okOpenBook();
      }
    });
  }

  var ctaUrl = "";
  var ctaNewTab = false;

  // 予約フォームを開く。店舗が「新しいタブで開く」を選んでいれば別タブで開く (issue #2535)。
  // iframe 版の枠に閉じ込められない。ポップアップがブロックされたら今のオーバーレイに戻し、
  // 「押しても何も起きない」にはしない
  function openBooking(url) {
    if (ctaNewTab) {
      var w = window.open(safeUrl(url), "_blank");
      if (w) {
        try { w.opener = null; } catch (_) {}
        return;
      }
    }
    openOverlay(url);
  }

  // ctaUrl にクエリが有るか (booking は ?therapist= 付き / booking_pick は無し) は
  // モードで決まるが、片方にパラメータを 1 個足した瞬間に "?a=b?c=d" と無言で壊れる。
  // 継ぎ手を 1 箇所に寄せて、どちらのモードでも正しくなるようにする
  function ctaSep() {
    return ctaUrl.indexOf("?") === -1 ? "?" : "&";
  }

  // ── 推しコメウィジェット (issue #1235) ─────────────────────────────
  // 意匠は本体セラピスト詳細の推しコメセクション (#353) の縮約移植 (モック準拠)。
  // list / form / done の3ビューを .body 内で切り替える。
  // イベントは delegated listener (data-ok-action) で拾う。inline onclick は
  // 設置先の CSP (script-src に unsafe-inline が無いサイト) で無言で死ぬため使わない。
  var OK_ICONS = {
    pen: '<svg fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>',
    sparkle: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>',
    trophy: '<svg fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/></svg>',
    send: '<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>',
    close: '<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    check: '<svg fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    chev: '<svg fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'
  };
  // 実ロゴ (static/img/common/logo.svg のインライン)。ライトでは CSS が .cls-3 を紺に落とす
  var OK_LOGO = '<svg class="osw-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 931.94 182.53" aria-label="メンエスなう"><defs><style>.cls-1,.cls-2{fill:#e43f75}.cls-3{fill:#fff}.cls-3,.cls-2{stroke:#e43f75;stroke-miterlimit:10}</style></defs><g><path class="cls-1" d="M185.96,128.32c-13.53,19.21-28.77,36.07-45.03,52.5-.84.85-2.54,1.84-3.41,1.69s-2.41-1.05-3.29-1.92c-15.82-15.8-29.79-32.75-42.99-50.83-3.4-4.66-6.72-8.19-12.56-9.73l-22.12-5.85c-13.26-3.51-24.05-18.43-21.79-22.44,1.44-2.54,6.47,1.92,16.37,3.46l19.11,2.96c-4.11-3.81-9.24-5.82-14.59-7.43-26.29-7.92-34.9-14.88-45.51-41.03-.33-.82.67-3.04,1.47-3.27.93-.27,2.58.4,3.49,1.35,6.69,7.01,15.23,11.26,24.34,14.63l28.09,10.38c-2.91-3.06-6.37-5.09-10.02-6.97l-24.71-12.71C3.32,37.93-3.71.29,1.65,0c1.01-.05,2.57.9,3.06,1.91,3.11,6.49,8,11.19,13.85,15.33,10.77,7.62,22.31,13.34,34.2,19.21,18.73,9.24,38.17,18.16,40.56,41.64l-4.82,1.66c4.67,25.7,28.28,54.64,46.34,72.94,1.65,1.67,4.26,1.65,5.85.06,17.08-17.25,39.88-45.55,44.36-69.67,3.12-16.78-1.92-33.32-13.92-44.8-12.2-11.67-29.08-16.53-45.95-12.21-15.53,3.97-27.74,15.26-33.95,30.32-4.25-4.78-8.54-9.19-12.73-12.74-.76-.65-.63-2.85-.07-3.78,11.11-18.28,29.49-30.87,50.93-33.27,24.85-2.78,49.18,7.35,63.72,27.6,20.96,29.21,12.76,65.91-7.1,94.12Z"/><path class="cls-1" d="M137.68,146.13c-15.24-16.55-34.48-39.84-40.81-61.08-5.65-18.96,2.45-38.66,19.87-48.26,12.7-7,27.96-7.36,41.27.09,20.71,11.59,25.75,35.79,16.53,57.2-8.12,18.85-21.97,35.93-36.86,52.06ZM134.23,53.61c-12.5,1.9-20.08,13.61-17.83,25.35,2.17,11.36,12.91,19.04,24.91,17.01,11.13-1.89,19.46-12.84,17.52-24.45-1.88-11.27-12.32-19.77-24.59-17.91Z"/><g><path class="cls-3" d="M325.01,48.43l-14.33,44.17,26.62,19.01v23.99l-34.67-24.57c-.29.58-.64,1.17-1.02,1.76-3.9,6.14-8.73,11.34-14.48,15.58-5.75,4.24-12.09,6.56-19.02,6.95h-20.19v-19.6h21.36c3.7-.19,7.19-1.61,10.46-4.24,3.27-2.63,5.73-5.65,7.39-9.07.29-.58.58-1.22.88-1.9l-37.3-26.91v-23.99l43.88,31.45,10.53-32.62h19.89Z"/><path class="cls-3" d="M358.36,49.02h54.12v19.6h-54.12v-19.6ZM457.97,49.02l-16.97,52.07c-3.9,11.12-8.78,19.5-14.63,25.16-5.85,5.66-12.24,8.68-19.16,9.07h-35.1v-19.6h30.13c3.7-.19,7.19-1.61,10.46-4.24,3.27-2.63,5.73-5.63,7.39-9,1.66-3.36,3.07-7.04,4.24-11.04l13.16-42.42h20.48Z"/><path class="cls-3" d="M473.33,115.72h36.27v-47.1h-36.27v-19.6h92.15v19.6h-36.13v47.1h36.13v19.6h-92.15v-19.6Z"/><path class="cls-3" d="M585.96,49.02h81.03c2.73,0,5.07.93,7.02,2.78,1.85,1.95,2.78,4.29,2.78,7.02,0,1.76-.39,3.36-1.17,4.83l-20.19,33.2,40.66,38.47h-28.81l-23.26-21.94c-4.19,5.27-8.48,9.56-12.87,12.87-7.51,5.66-14.77,8.68-21.79,9.07h-22.82v-19.6h21.36c3.7-.19,7.56-1.61,11.56-4.24,4-2.63,7.31-5.63,9.95-9s5.12-7.04,7.46-11.04l13.6-22.82h-64.5v-19.6Z"/><path class="cls-2" d="M700.92,52.97h15.21l1.32-7.46h19.89l-1.17,7.46h27.64v17.99h-31.01l-10.68,55.87h-19.89l10.53-55.87h-11.85v-17.99ZM792.93,76.81v12.58h13.02v17.41h-13.02v2.78c-.1,8.1-2.83,14.75-8.19,19.97-5.36,5.22-11.46,8.02-18.28,8.41h-6.44c-6.44-.29-11.75-1.76-15.94-4.39-4.49-2.63-7.68-5.73-9.58-9.29-1.9-3.56-2.85-7.09-2.85-10.6s.97-7.46,2.93-11.56c1.95-4.1,4.97-7.22,9.07-9.36,4.1-2.14,7.99-3.24,11.7-3.29,3.7-.05,5.85-.07,6.44-.07h11.41v-12.58h19.75ZM770.26,116.74c2.05-2.24,3.02-5.22,2.93-8.92v-1.02h-13.16c-1.85-.1-3.39.27-4.61,1.1-1.22.83-2.12,1.73-2.71,2.71-.58.98-.88,2-.88,3.07,0,.58.29,1.46.88,2.63.58,1.17,1.49,2.15,2.71,2.93,1.22.78,2.75,1.22,4.61,1.32h1.46c3.71-.19,6.63-1.46,8.78-3.8ZM772.89,52.97h30.13v17.99h-30.13v-17.99Z"/><path class="cls-2" d="M820.72,79.44h73.72c.58,0,1.17.05,1.75.15h.88c6.82.2,12.43,1.88,16.82,5.05,4.39,3.17,7.56,6.75,9.51,10.75,1.95,4,2.93,8.04,2.93,12.14s-.95,8.29-2.85,12.29c-1.9,4-5.07,7.58-9.51,10.75-4.44,3.17-10.07,4.75-16.89,4.75h-57.63v-19.6h58.51c1.85,0,3.39-.46,4.61-1.39,1.22-.93,2.12-2.02,2.71-3.29.58-1.27.88-2.49.88-3.66s-.29-2.39-.88-3.66c-.58-1.27-1.49-2.36-2.71-3.29-1.22-.93-2.76-1.39-4.61-1.39h-77.23v-19.6ZM835.93,49.02h77.23v19.6h-77.23v-19.6Z"/></g></g></svg>';

  // 入力値 (コメント・ニックネーム等) はフォームを再描画しない方針のため DOM が正。
  // state に持つのは DOM から導出できないもの (選択タグ・ビュー・宛先の初期選択) だけ
  var okData = null;      // API レスポンス
  var okMount = null;     // 描画先 (.body)
  // formTherapist = 店舗単位でフォームを開いたときの宛先の初期選択 (puid)
  var okState = { view: "list", tags: [], rec: [], submitting: false, tsToken: "", formTherapist: "" };
  var okTsScript = null;
  var okTsWidgetId = null;
  var okTsBlocked = false;  // 設置先の CSP 等で認証を出せなかった
  var okListHeight = 0;     // 一覧ビューの実高さ。フォーム/完了もこれに合わせて枠を動かさない
  var OK_FORM_MIN_HEIGHT = 520;  // 一覧が低い店でもフォームが窮屈にならない下限
  var OK_CLAMP_LENGTH = 140;     // これを超える本文は畳んで「続きを読む」で開く
  // 宛先の選択肢 (店舗単位のみ)。300 人超の店があるので一覧では配らず、
  // フォームを開いたときに取りに行く。null = 未取得
  var okRoster = null;
  var okRosterLoading = false;
  var okRosterFailed = false;
  var OK_ROSTER_FILTER_MIN = 20;  // これを超える名簿には絞り込み入力を出す (素の select では選べない)
  // 全件表示の続き (issue #1551)。API は 30 件ずつ返すので、一覧の枠内スクロール末尾で足す
  var okHasMore = false;
  var okLoadingMore = false;

  function okCardHtml(r) {
    // 全文を持っているが、長文をそのまま並べるとカード1枚が一覧の窓より高くなり
    // 延々スクロールさせることになる。畳んで「続きを読む」でその場に開く
    // (設置先は店舗自身の HP なので、本体へ読みに行かせる導線にはしない)
    var comment = r.comment || "";
    var body = '<p class="osw-card-body">' + esc(comment) + '</p>';
    if (okTextLength(comment) > OK_CLAMP_LENGTH) {
      body = '<div class="osw-clamp">' + body + '<span class="osw-clamp-fade"></span></div>'
        + '<button class="osw-more" type="button" data-ok-action="expand">' + OK_ICONS.chev + '続きを読む</button>';
    }
    var tags = (r.tags || []).map(function (t) { return '<span class="osw-card-tag">' + esc(t) + '</span>'; }).join("");
    if (r.recommended_for) tags += '<span class="osw-card-rec">' + esc(r.recommended_for) + 'におすすめ</span>';
    var foot = tags ? '<div class="osw-card-tags">' + tags + '</div>' : "";
    var author = r.author || "ゲスト";
    var guest = r.is_guest ? '<span class="osw-guest">ゲスト</span>' : "";
    // 店舗単位は宛先が1人に定まらないので、誰への推しコメかをカードの主見出しにし (#1282)、
    // 投稿者はその下に従属させる (#1551。投稿者が主役に見えると口コミの宛先が伝わらない)。
    // 在籍中の相手ならフォームの初期選択にできるボタンを添える
    // (「選ばせる手間」がそのまま投稿の離脱になるため)
    if (r.therapist) {
      var write = r.therapist_puid && okCanPost()
        ? '<button class="osw-card-to act" type="button" data-ok-action="open-form" data-ok-therapist="'
          + esc(r.therapist_puid) + '" aria-label="' + esc(r.therapist) + 'さんに推しコメを書く">'
          + OK_ICONS.pen + 'この人に書く</button>'
        : "";
      return '<article class="osw-card">'
        + '<div class="osw-card-h">'
        + '<span class="osw-av">' + esc(r.therapist.slice(0, 1).toUpperCase()) + '</span>'
        + '<div class="osw-card-meta">'
        + '<p class="osw-card-to-nm"><span>' + esc(r.therapist) + '</span><small>さんへの推しコメ</small></p>'
        + '<p class="osw-card-by"><span class="osw-card-by-nm">投稿：'
        + esc(author === "ゲスト" ? author : author + "さん") + '</span>'
        + (author === "ゲスト" ? "" : guest)
        + '<span class="osw-card-dt">' + esc(r.date_label || "") + '</span></p>'
        + '</div>' + write + '</div>' + body + foot
        + '</article>';
    }
    return '<article class="osw-card">'
      + '<div class="osw-card-h">'
      + '<span class="osw-av">' + esc(author.slice(0, 1).toUpperCase()) + '</span>'
      + '<div class="osw-card-meta">'
      + '<p class="osw-card-nm">' + esc(author) + '</p>'
      + '<p class="osw-card-dt">' + esc(r.date_label || "") + '</p>'
      + '</div>' + guest + '</div>' + body + foot
      + '</article>';
  }

  function okSummaryHtml() {
    var s = okData.summary;
    if (!s) return "";
    var pods = s.podium || [];
    var html = '<div class="osw-sum"><div class="osw-sum-pad"><div class="osw-badges">'
      + '<span class="osw-title-badge">' + OK_ICONS.sparkle + esc(s.title || "") + '</span>';
    if (s.area_rank) {
      html += '<span class="osw-area-badge">' + OK_ICONS.trophy + esc(s.area_name || "") + 'で推しコメ' + s.area_rank + '位</span>';
    }
    html += '</div>';
    if (s.headline && s.headline.length === 3) {
      html += '<p class="osw-headline">' + esc(s.headline[0]) + '<em>' + esc(s.headline[1]) + '</em>' + esc(s.headline[2]) + '</p>';
    }
    html += '<p class="osw-sum-cap">推しコメ' + okData.total + '件から自動で集計</p></div>';
    // 表彰台 (2位・1位・3位の並び。2・3位はいなければ枠ごと出さない)
    if (pods.length) {
      html += '<div class="osw-podium">';
      if (pods[1]) {
        html += '<div class="pod"><span class="pod-rank"><span class="rank-num rank-num-silver">2</span></span>'
          + '<div class="pod-card silver"><p class="pod-label">' + esc(pods[1].label) + '</p><p class="pod-count">' + pods[1].count + '人が実感</p></div></div>';
      }
      html += '<div class="pod pod-1"><span class="pod-crown">' + OK_ICONS.trophy + '</span>'
        + '<div class="pod-card gold"><p class="pod-label">' + esc(pods[0].label) + '</p><p class="pod-count">' + pods[0].count + '人が実感</p>'
        + '<p class="pod-note">いちばんの推しポイント</p></div></div>';
      if (pods[2]) {
        html += '<div class="pod pod-3"><span class="pod-rank"><span class="rank-num rank-num-bronze">3</span></span>'
          + '<div class="pod-card bronze"><p class="pod-label">' + esc(pods[2].label) + '</p><p class="pod-count">' + pods[2].count + '人が実感</p></div></div>';
      }
      html += '</div>';
    }
    if (s.extra_chips && s.extra_chips.length) {
      html += '<div class="osw-extra"><span class="osw-extra-label">ほかにも</span>'
        + s.extra_chips.map(function (c) { return '<span class="osw-extra-chip">' + esc(c.label) + '<b>' + c.count + '</b></span>'; }).join("")
        + '</div>';
    }
    html += '<p class="osw-sum-foot">' + okData.total + '件の推しコメをもとにした傾向です。感じ方には個人差があります。</p></div>';
    return html;
  }

  function okCanPost() {
    // okPost=false のときは API URL に &post=0 が付き form が返らないので、form の有無で閉じる
    if (!okData.form) return false;
    // 店舗単位は宛先を選ばせる方式なので、在籍セラピストが 0 人の店では投稿口を出さない
    // (選択肢の無いフォームを開かせても必ず弾かれる)
    if (okStoreScope) return okData.form.therapist_count > 0;
    return true;
  }

  function okListHtml() {
    var t = okData.therapist || {};
    var s = okData.store || {};
    var writePill = okCanPost()
      ? '<button class="osw-write-pill" type="button" data-ok-action="open-form">' + OK_ICONS.pen + '推しコメを書く</button>' : "";
    var html = '<div class="osw-head"><span class="osw-head-dot"></span><span class="osw-head-tt">推しコメ</span>'
      + '<span class="osw-head-n">' + okData.total + '件</span>' + writePill + '</div>'
      + '<p class="osw-head-desc">セラピストへ寄せられた応援コメント（口コミ）です</p>'
      + '<p class="osw-head-store">' + (t.name ? esc(t.name) + 'さん｜' : "") + esc(s.name || "") + '</p>'
      + okSummaryHtml();
    var cards = (okData.items || []).map(okCardHtml).join("");
    if (cards) {
      html += '<div class="osw-list">' + cards
        + (okHasMore ? '<div class="osw-loader"><div class="spinner"></div></div>' : "") + '</div>';
    } else {
      html += '<div class="osw-empty">推しコメはまだありません' + (okCanPost() ? '。最初の推しコメを書いてみませんか？' : "") + '</div>';
    }
    if (okCanPost()) {
      html += '<div class="osw-cta-wrap"><button class="osw-cta" type="button" data-ok-action="open-form">'
        + OK_ICONS.pen + (t.name ? esc(t.name) + 'さんに推しコメを書く' : 'このお店に推しコメを書く') + '</button></div>';
    }
    // フッターは提供元の表示のみ。設置先は店舗自身の HP なので、そこから
    // 客を本体へ連れ出す導線は置かない。ロゴは #1032 のトグルに従い、
    // OFF なら出すものが無いのでフッターごと畳む
    if (s.brand_logo_enabled !== false) {
      html += '<div class="osw-foot"><span class="osw-brand"><span class="pw">Powered by</span>' + OK_LOGO + '</span></div>';
    }
    return html;
  }

  function okFormHtml() {
    var t = okData.therapist || {};
    var s = okData.store || {};
    var form = okData.form;
    // 宛先。セラピスト単位は確定しているので読み取り専用、店舗単位は選択させる (#1282)。
    // 選択肢は別リクエストなので、未着なら空の select を置いて okFillRoster が後から埋める
    var picker;
    if (okStoreScope) {
      picker = (form.therapist_count > OK_ROSTER_FILTER_MIN
        ? '<input class="osw-input osw-roster-q" type="text" data-ok-input="therapist-q" placeholder="名前で絞り込む">' : "")
        + '<select class="osw-select" data-ok-input="therapist"></select>'
        + '<p class="osw-roster-err" data-ok-role="roster-err" hidden></p>';
    } else {
      var av = t.image
        ? '<span class="av"><img src="' + esc(safeUrl(t.image)) + '" alt=""></span>'
        : '<span class="av">' + esc((t.name || "セ").slice(0, 1)) + '</span>';
      picker = '<div class="osw-sel-t">' + av + '<span class="nm">' + esc(t.name || "") + '</span></div>';
    }
    var groups = (form.tag_groups || []).map(function (g) {
      return '<div><p class="osw-tag-cat">' + esc(g.label) + '</p><div class="osw-chips">'
        + g.tags.map(function (tag) {
          return '<button class="osw-chip" type="button" data-ok-action="tag" data-ok-val="' + esc(tag.slug) + '">' + esc(tag.label) + '</button>';
        }).join("") + '</div></div>';
    }).join("");
    var recChips = (form.recommended_for || []).map(function (r) {
      return '<button class="osw-chip" type="button" data-ok-action="rec" data-ok-val="' + esc(r.value) + '">' + esc(r.label) + '</button>';
    }).join("");
    return '<div class="osw-form">'
      + '<div class="osw-form-head"><div>'
      + '<p class="osw-form-tt">推しコメを書く</p>'
      + '<p class="osw-form-sub">' + (t.name ? esc(t.name) + '｜' : "") + esc(s.name || "") + '</p>'
      // 単体モードではオーバーレイ側の × が同じ位置に重なるので、フォーム側は出さない
      + '</div>' + (okComposeFramed ? "" : '<button class="osw-close" type="button" data-ok-action="back" aria-label="閉じる">' + OK_ICONS.close + '</button>') + '</div>'
      + '<div class="osw-form-body">'
      + '<div><label class="osw-flabel">担当セラピスト' + (okStoreScope ? ' <span class="req">*</span>' : "") + '</label>' + picker + '</div>'
      + '<div><label class="osw-flabel">推しポイント <span class="req">*</span><span class="opt">（1つ以上）</span></label>'
      + '<div class="osw-tag-groups">' + groups + '</div></div>'
      + '<div><label class="osw-flabel">コメント <span class="req">*</span></label>'
      + '<textarea class="osw-ta" rows="4" maxlength="500" data-ok-input="comment" placeholder="セラピストの対応や施術の感想など、推しポイントを' + okMinLength() + '文字以上で教えてください"></textarea>'
      + '<div class="osw-counter-row"><span class="osw-counter-left" data-ok-role="counter">あと' + okMinLength() + '文字</span><span class="osw-counter-right" data-ok-role="total">0/500</span></div></div>'
      + '<div><label class="osw-flabel">ニックネーム <span class="opt">（任意）</span></label>'
      + '<input class="osw-input" type="text" maxlength="50" placeholder="ゲスト" data-ok-input="nick"></div>'
      + '<div><button class="osw-extras-btn" type="button" data-ok-action="extras">' + OK_ICONS.chev + '任意項目を追加（どんな人におすすめ？ など）</button>'
      + '<div class="osw-extras">'
      + '<div><label class="osw-flabel">どんな人におすすめ？ <span class="opt">（任意・複数可）</span></label><div class="osw-chips">' + recChips + '</div></div>'
      + '<div><label class="osw-flabel">似ている芸能人 <span class="opt">（任意）</span></label>'
      + '<input class="osw-input" type="text" maxlength="50" placeholder="例: 〇〇さん似" data-ok-input="celeb">'
      + '<p class="osw-fnote">※ 集計は会員限定コンテンツとしてメンエスなう本体に表示されます</p></div>'
      + '</div></div>'
      + '<div class="osw-ts"></div>'
      + '</div>'
      + '<div class="osw-form-foot">'
      + '<p class="osw-err" data-ok-role="error" hidden></p>'
      + '<button class="osw-submit" type="button" data-ok-action="submit" disabled>' + OK_ICONS.send + '推しコメを投稿する</button>'
      + '<p class="osw-trust">投稿は運営による<b>審査後に公開</b>されます。</p>'
      + '</div></div>';
  }

  // 予約ビュー (issue #1304)。宛先が定まらない店舗単位で、相手を選ばせてから
  // 予約オーバーレイを開く。選択肢の描画は投稿フォームと同じ okFillRoster に相乗りする
  // (data-ok-input="therapist" を同じ名前にしてあるので分岐が要らない)
  function okBookHtml() {
    var s = okData.store || {};
    // 予約できる相手の数はサーバが cta.pick_count で配る。投稿フォームの therapist_count は
    // 受付停止中も含む別の母集団で、post=0 の店ではそもそも返ってこない
    var filter = (okData.cta && okData.cta.pick_count > OK_ROSTER_FILTER_MIN);
    return '<div class="osw-form">'
      + '<div class="osw-form-head"><div>'
      + '<p class="osw-form-tt">WEB予約する</p>'
      + '<p class="osw-form-sub">' + esc(s.name || "") + '</p>'
      + '</div><button class="osw-close" type="button" data-ok-action="back" aria-label="閉じる">' + OK_ICONS.close + '</button></div>'
      + '<div class="osw-form-body">'
      + '<div><label class="osw-flabel">ご希望のセラピスト <span class="req">*</span></label>'
      + (filter ? '<input class="osw-input osw-roster-q" type="text" data-ok-input="therapist-q" placeholder="名前で絞り込む">' : "")
      + '<select class="osw-select" data-ok-input="therapist"></select>'
      + '<p class="osw-roster-err" data-ok-role="roster-err" hidden></p></div>'
      + '<p class="osw-book-note">選んだセラピストの予約フォームが開きます。</p>'
      + '</div>'
      + '<div class="osw-form-foot">'
      + '<button class="osw-submit" type="button" data-ok-action="book-go" disabled>' + svgCal + '予約に進む</button>'
      + '</div></div>';
  }

  // CTA から呼ばれる。名簿が未取得なら取りに行き、届き次第 okFillRoster が埋める
  function okOpenBook() {
    okState.view = "book";
    okState.formTherapist = "";
    okLoadRoster();
    renderOshikome();
  }

  function okBookGo() {
    var puid = okFormValue("therapist");
    if (!puid) return;
    if (!preview) reportCtaClick("booking_pick");
    openBooking(base + ctaUrl + ctaSep() + "therapist=" + encodeURIComponent(puid)
                + "&theme=" + (dark ? "dark" : "light")
                + "&host=" + encodeURIComponent(location.host)
                + (preview ? "&preview=1" : ""));
  }

  function okDoneHtml() {
    return '<div class="osw-done">'
      + '<div class="osw-done-ic">' + OK_ICONS.check + '</div>'
      + '<h4>投稿を受け付けました</h4>'
      + '<p class="d1">運営による審査後に公開されます。</p>'
      + '<p class="d2">公開まで少しお時間をいただくことがあります。<br>掲載されなかった場合のご連絡はいたしません。</p>'
      + '<button class="osw-done-btn" type="button" data-ok-action="back">閉じる</button>'
      + '</div>';
  }

  // 単体モード専用。設置先ページを開いた後に受付が止まった (受付 OFF・在籍 0 人) とき
  function okClosedHtml() {
    return '<div class="osw-done">'
      + '<h4>現在、推しコメの投稿を受け付けていません</h4>'
      + '<button class="osw-done-btn" type="button" data-ok-action="back">閉じる</button>'
      + '</div>';
  }

  // フォーム内の操作 (タグ選択・入力) は再描画せず DOM を直接更新する。
  // ビュー全体を innerHTML で組み直すと入力フォーカスも Turnstile ウィジェットも飛ぶため
  function okFormValue(name) {
    var el = okMount.querySelector('[data-ok-input="' + name + '"]');
    return el ? el.value : "";
  }

  // サーバの検証と同じ下限。JS 側に数字を持たず、フォームマスタの値に従う
  function okMinLength() {
    var n = okData.form && okData.form.comment_min_length;
    return typeof n === "number" ? n : 30;
  }

  // 文字数はサーバ (Python の len = コードポイント数) に合わせて数える。
  // 素の String.length は UTF-16 単位なので、絵文字は 1 文字が 2 と数えられ、
  // 「OK」と出したのにサーバが 400 を返す食い違いになる
  function okTextLength(s) {
    return s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "_").length;
  }

  // 投稿の宛先。セラピスト単位はタグの属性、店舗単位はフォームの選択値 (#1282)
  function okTherapistPuid() {
    return okStoreScope ? okFormValue("therapist") : therapistPuid;
  }

  // 宛先の選択肢を取りに行く。フォームは再描画しない (入力も Turnstile も飛ぶため)、
  // 届いたら select の中身だけ差し替える
  function okLoadRoster() {
    if (okRoster || okRosterLoading) return;
    okRosterLoading = true;
    // 再試行のたびに前回の失敗表示を消す (残すと取得中も「読み込めませんでした」のままになる)
    okRosterFailed = false;
    okFillRoster();
    fetch(base + "/widget/api/oshikome/" + encodeURIComponent(storePuid) + "/?therapists=1").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (d) {
      okRoster = d.therapists || [];
    }).catch(function () {
      okRosterFailed = true;
    }).then(function () {
      okRosterLoading = false;
      okFillRoster();
    });
  }

  function okFillRoster() {
    var sel = okMount && okMount.querySelector('[data-ok-input="therapist"]');
    if (!sel) return;
    var errEl = okMount.querySelector('[data-ok-role="roster-err"]');
    if (!okRoster) {
      sel.innerHTML = '<option value="">' + (okRosterFailed ? "読み込めませんでした" : "読み込み中...") + "</option>";
      sel.disabled = true;
      // 失敗したまま閉じさせない。フォームを開き直すと入力もタグも消えるので、
      // 描き直さずにその場で再取得できる導線をフォーム内に置く
      if (errEl) {
        errEl.innerHTML = okRosterFailed
          ? 'セラピスト一覧を読み込めませんでした。<button class="osw-roster-retry" type="button" data-ok-action="retry-roster">再読み込み</button>'
          : "";
        errEl.hidden = !okRosterFailed;
      }
      okUpdateSubmit();
      return;
    }
    if (errEl) { errEl.innerHTML = ""; errEl.hidden = true; }
    var q = okFormValue("therapist-q").trim().toLowerCase();
    // 予約ビューは受付中の相手だけ (推しコメは受付停止中でも書ける)
    var bookOnly = okState.view === "book";
    var hits = [];
    for (var i = 0; i < okRoster.length; i++) {
      if (bookOnly && okRoster[i].bookable === false) continue;
      if (!q || okRoster[i].name.toLowerCase().indexOf(q) !== -1) hits.push(okRoster[i]);
    }
    // 宛先はユーザーが select で選んだものだけ。絞り込みは選択肢を絞るだけに留める
    // (「1 人に絞れたら自動で入れる」は、誰が入れた値かの管理が要るわりに節約できるのは
    //  タップ 1 回で、打ち直しの途中経過で別人宛ての投稿を作る事故を繰り返したため撤去した)。
    // formTherapist (カードのチップ由来の初期値) は初回の描画にだけ効かせる
    // (残すと「選択してください」に戻したあとチップの相手が復活する)
    var picked = sel.value || okState.formTherapist;
    okState.formTherapist = "";
    // 選択中の相手が絞り込みから外れていても選択肢には残す (打ち直しで選択が飛ばないように)
    var shown = hits;
    for (i = 0; i < okRoster.length; i++) {
      if (okRoster[i].puid === picked && hits.indexOf(okRoster[i]) === -1) shown = [okRoster[i]].concat(hits);
    }
    var html = '<option value="">選択してください</option>';
    for (i = 0; i < shown.length; i++) {
      html += '<option value="' + esc(shown[i].puid) + '"' + (shown[i].puid === picked ? " selected" : "")
        + ">" + esc(shown[i].name) + "</option>";
    }
    sel.innerHTML = html;
    sel.disabled = false;
    okUpdateSubmit();
  }

  function okUpdateSubmit() {
    // 予約ビューは宛先が決まっていれば進める (コメント・タグは要らない)
    var go = okMount.querySelector('[data-ok-action="book-go"]');
    if (go) { go.disabled = !okFormValue("therapist"); return; }
    var btn = okMount.querySelector('[data-ok-action="submit"]');
    if (!btn) return;
    var ready = okTextLength(okFormValue("comment").trim()) >= okMinLength()
      && okState.tags.length > 0 && !!okTherapistPuid() && !okState.submitting && !okTsBlocked;
    btn.disabled = !ready;
  }

  function okShowError(msg) {
    var el = okMount.querySelector('[data-ok-role="error"]');
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  // Turnstile を shadow 内へ明示レンダリングする。closed shadow でも要素参照渡しで動く。
  // site key 未設定 (dev) のときはスキップし、成否はサーバ検証に委ねる
  function okMountTurnstile() {
    var key = okData.form && okData.form.turnstile_site_key;
    var slot = okMount.querySelector(".osw-ts");
    if (!key || !slot) return;
    // 認証を出せない環境がある: 設置先の CSP や広告ブロッカーが
    // challenges.cloudflare.com を塞ぐ場合と、site key の許可ホストに設置先ドメインが
    // 入っていない場合 (後者が最も起きやすく、render は例外を投げず error-callback で来る)。
    // 黙って進むと「送信を押すたびに 403」になり店舗も運営も原因を切り分けられないので、
    // 送信前に理由を見せて投稿を止める。原因を断定はできないので再読み込みも促す
    var fail = function () {
      okTsBlocked = true;
      // 通信断や CF 側の一時障害でも来るため、次に開き直したときは1度だけ読み直す
      okTsScript = null;
      okShowError("認証を読み込めませんでした。ページを再読み込みしてお試しください（このページで認証がブロックされている場合はメンエスなうのページから投稿できます）");
      okUpdateSubmit();
    };
    var render = function () {
      var cur = okMount.querySelector(".osw-ts");
      if (!cur || cur.childNodes.length) return;
      if (!window.turnstile) { fail(); return; }
      try {
        okTsWidgetId = window.turnstile.render(cur, {
          sitekey: key,
          callback: function (token) { okState.tsToken = token; },
          // 許可ホスト外・チャレンジ失敗はここに来る (render は例外を投げない)
          "error-callback": fail,
        });
      } catch (e) { fail(); }
    };
    // ブロック済みでも turnstile が使えるようになっていれば描き直す
    if (okTsBlocked && !window.turnstile) { fail(); return; }
    okTsBlocked = false;
    if (window.turnstile) { render(); return; }
    if (!okTsScript) {
      okTsScript = document.createElement("script");
      okTsScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      okTsScript.async = true;
      // 到着時に描画する。ロード完了前にフォームを閉じて開き直しても、
      // render が最新の .osw-ts を引き直すのでリスナーは1本で足りる
      okTsScript.addEventListener("load", render);
      okTsScript.addEventListener("error", fail);
      document.head.appendChild(okTsScript);
    }
  }

  function okSubmit() {
    if (okState.submitting) return;
    var comment = okFormValue("comment").trim();
    var nick = okFormValue("nick").trim();
    var celeb = okFormValue("celeb").trim();
    var toPuid = okTherapistPuid();
    if (okTextLength(comment) < okMinLength() || okState.tags.length === 0 || !toPuid) return;
    okState.submitting = true;
    okShowError("");
    var btn = okMount.querySelector('[data-ok-action="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="osw-spin"></span>投稿中...'; }

    var finish = function () {
      okState.submitting = false;
      okState.view = "done";
      // 選択 state のリセットは open-form 側に一本化 (フォームは毎回まっさらに開く)
      renderOshikome();
    };
    // 管理画面プレビューからは本物の pending を審査キューに積ませない (送信せず完了画面だけ再現)
    if (preview) { setTimeout(finish, 400); return; }

    var params = [
      "therapist=" + encodeURIComponent(toPuid),
      "comment=" + encodeURIComponent(comment),
    ];
    okState.tags.forEach(function (s) { params.push("oshi_points=" + encodeURIComponent(s)); });
    okState.rec.forEach(function (v) { params.push("recommended_for=" + encodeURIComponent(v)); });
    if (celeb) params.push("similar_celebrity=" + encodeURIComponent(celeb));
    if (nick) params.push("guest_name=" + encodeURIComponent(nick));
    if (okState.tsToken) params.push("cf-turnstile-response=" + encodeURIComponent(okState.tsToken));

    // form-urlencoded の simple request にして preflight を回避する
    fetch(base + "/widget/api/oshikome/" + encodeURIComponent(storePuid) + "/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.join("&"),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; });
    }).then(function (res) {
      if (!res.ok) throw new Error(res.data.error || "投稿に失敗しました。時間をおいてお試しください");
      finish();
    }).catch(function (e) {
      okState.submitting = false;
      // Turnstile トークンは使い切りなので、リトライに備えてウィジェットごとリセットする
      okState.tsToken = "";
      if (window.turnstile && okTsWidgetId !== null) {
        try { window.turnstile.reset(okTsWidgetId); } catch (err) {}
      }
      if (btn) { btn.innerHTML = OK_ICONS.send + '推しコメを投稿する'; }
      okUpdateSubmit();
      okShowError(String((e && e.message) || "投稿に失敗しました。時間をおいてお試しください"));
    });
  }

  function okBindFormInputs() {
    // 宛先の選択も送信可否に効くので拾う (店舗単位のみ存在する)
    var sel = okMount.querySelector('[data-ok-input="therapist"]');
    if (sel) sel.addEventListener("change", okUpdateSubmit);
    var rq = okMount.querySelector('[data-ok-input="therapist-q"]');
    if (rq) rq.addEventListener("input", okFillRoster);
    // 入力値は DOM が正 (okFormValue で読む)。リスナーはカウンター表示の更新だけに使う
    var ta = okMount.querySelector('[data-ok-input="comment"]');
    if (!ta) return;
    ta.addEventListener("input", function () {
      var len = okTextLength(ta.value.trim());
      var min = okMinLength();
      var counter = okMount.querySelector('[data-ok-role="counter"]');
      var total = okMount.querySelector('[data-ok-role="total"]');
      if (counter) {
        counter.textContent = len >= min ? "OK" : "あと" + (min - len) + "文字";
        counter.className = "osw-counter-left" + (len >= min ? " ok" : "");
      }
      if (total) total.textContent = ta.value.length + "/500";
      okUpdateSubmit();
    });
  }

  function renderOshikome() {
    if (!okMount) return;
    var view = okState.view;
    // 単体モードには戻る先の一覧が無いので、投稿できないときは理由を見せる
    if (view === "form" && !okCanPost()) view = okState.view = okCompose ? "closed" : "list";
    okMount.innerHTML = view === "form" ? okFormHtml()
      : view === "closed" ? okClosedHtml()
      : view === "book" ? okBookHtml()
      : view === "done" ? okDoneHtml() : okListHtml();
    // 設置先は店舗の HP なので、ビューを切り替えるたびに枠の高さが変わると
    // 下にある本文が飛ぶ。一覧の高さを基準に固定し、はみ出す分はフォーム内部で
    // スクロールさせる (推しコメ0件など一覧が極端に低いときはフォームの下限を優先)
    if (view === "list") {
      okMount.style.height = "";
      okListHeight = okMount.offsetHeight;
      okWatchListScroll();
    } else if (okCompose) {
      // 単体モードは基準にする一覧が無い。オーバーレイの枠いっぱいに広げる
      okMount.style.height = "100%";
    } else {
      okMount.style.height = Math.max(okListHeight, OK_FORM_MIN_HEIGHT) + "px";
    }
    // 予約CTA は .body の外 (.root 直下) にあるので、ビューを切り替えても残ってしまう。
    // フォーム/予約/完了では邪魔なだけでなく、下端のボタンを覆うので隠す (issue #1304)。
    // display:none は不可。.cta は sticky = 通常フローに場所を取るので、消すと
    // ウィジェットが 60px 強縮んで設置先の本文が飛ぶ (okMount の高さを固定して
    // 防いでいるのと同じ事故)。visibility なら箱は残り、子孫のヒットテストも切れる
    var ctaEl = okMount.parentNode && okMount.parentNode.querySelector(".cta");
    if (ctaEl) ctaEl.style.visibility = view === "list" ? "" : "hidden";
    if (view === "form" || view === "book") {
      okBindFormInputs();
      if (okStoreScope) okFillRoster();
      // 予約ビューは Turnstile を出さない (投稿しないため)
      if (view === "form") okMountTurnstile();
      okUpdateSubmit();
    }
  }

  // 全件表示の続きのページ (issue #1551)。予約CTA の表示回数を二重に記録しないよう pick=1 は
  // 付けず、使わない集計サマリーも止める。post は初回と揃える: 外すと店舗単位では
  // 宛先の puid が返らず、2ページ目以降のカードだけ「この人に書く」が消える
  function okPageUrl(offset) {
    return base + "/widget/api/oshikome/" + encodeURIComponent(storePuid)
      + "/?count=all&offset=" + offset + "&summary=0"
      + (therapistPuid ? "&therapist=" + encodeURIComponent(therapistPuid) : "")
      + (preview ? "&preview=1" : "") + (okPost ? "" : "&post=0");
  }

  // 一覧はビューを切り替えるたびに作り直すので、描画のたびに監視を付け直す
  function okWatchListScroll() {
    var list = okMount.querySelector(".osw-list");
    if (!list || !okHasMore) return;
    var ticking = false;
    list.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        if (list.scrollTop + list.clientHeight >= list.scrollHeight - 120) okLoadMore();
        ticking = false;
      });
    });
  }

  function okLoadMore() {
    if (!okHasMore || okLoadingMore) return;
    okLoadingMore = true;
    fetch(okPageUrl(okData.items.length)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      var items = data.items || [];
      okData.items = okData.items.concat(items);
      okHasMore = !!data.has_more && items.length > 0;
      okLoadingMore = false;
      // フォームを開いている間に届いたら state にだけ積む (一覧に戻ったとき全件で描き直す)
      var list = okState.view === "list" && okMount.querySelector(".osw-list");
      if (!list) return;
      var loader = list.querySelector(".osw-loader");
      if (loader) loader.parentNode.removeChild(loader);
      list.insertAdjacentHTML("beforeend", items.map(okCardHtml).join("")
        + (okHasMore ? '<div class="osw-loader"><div class="spinner"></div></div>' : ""));
    }).catch(function (e) {
      console.error("[MN Widget] oshikome loadMore", e);
      // 閲覧中に非公開化されると以降は 404 が続くので打ち切る。それ以外は次のスクロールで再試行
      if (/HTTP 404/.test(String(e && e.message))) {
        okHasMore = false;
        var loader = okMount.querySelector(".osw-loader");
        if (loader) loader.parentNode.removeChild(loader);
      }
      okLoadingMore = false;
    });
  }

  // okRemoteForm のときに開く投稿フォームの URL。iframe 版ラッパーを単体モードで開く
  function okComposeUrl(to) {
    return base + "/widget/embed/shop/" + encodeURIComponent(storePuid) + "/?type=oshikome"
      + (therapistPuid ? "&therapist=" + encodeURIComponent(therapistPuid) : "")
      + "&theme=" + (dark ? "dark" : "light")
      + "&fill=1&compose=1"
      + (to ? "&to=" + encodeURIComponent(to) : "");
  }

  function okHandleAction(action, el) {
    if (action === "open-form" && okRemoteForm) {
      openOverlay(okComposeUrl(el.getAttribute("data-ok-therapist") || ""), "推しコメを書く", "メンエスなうで推しコメを書く");
      return;
    }
    // 単体モードに戻る先の一覧は無い。フォームも完了画面も「閉じる」は親のオーバーレイを畳む
    if (action === "back" && okComposeFramed) {
      parent.postMessage({ type: "mn-widget", event: "compose-close" }, "*");
      return;
    }
    if (action === "open-form") {
      // フォームは毎回まっさらに開く (入力 DOM は作り直されるので選択 state も揃えて捨てる)
      okState.view = "form";
      okState.tags = []; okState.rec = []; okState.tsToken = "";
      // カードの宛先チップから開いたときは、その相手を初期選択にする (#1282)
      okState.formTherapist = el.getAttribute("data-ok-therapist") || "";
      if (okStoreScope) okLoadRoster();
      renderOshikome();
      return;
    }
    if (action === "retry-roster") { okLoadRoster(); return; }
    if (action === "book-go") { okBookGo(); return; }
    if (action === "back") { okState.view = "list"; renderOshikome(); return; }
    if (action === "submit") { okSubmit(); return; }
    if (action === "expand") {
      // 畳んだ本文をその場で開く。枠の高さは一覧の窓 (.osw-list) が受けるので動かない
      var card = el.previousElementSibling;
      if (card && card.className === "osw-clamp") {
        card.className = "";
        var fade = card.querySelector(".osw-clamp-fade");
        if (fade) fade.parentNode.removeChild(fade);
      }
      el.parentNode.removeChild(el);
      return;
    }
    if (action === "extras") {
      el.classList.toggle("open");
      var box = okMount.querySelector(".osw-extras");
      if (box) box.classList.toggle("open");
      return;
    }
    if (action === "tag" || action === "rec") {
      var val = el.getAttribute("data-ok-val");
      var arr = action === "tag" ? okState.tags : okState.rec;
      var idx = arr.indexOf(val);
      if (idx === -1) arr.push(val); else arr.splice(idx, 1);
      el.classList.toggle(action === "tag" ? "sel" : "sel-soft", idx === -1);
      okUpdateSubmit();
    }
  }

  function initOshikome(data) {
    okData = data;
    okMount = bodyEl;
    okHasMore = okCount === "all" && !!data.has_more;
    if (okCompose) {
      // 投稿できない場合は renderOshikome が「受け付けていません」に落とす
      okState.view = "form";
      okState.formTherapist = okComposeTo;
      if (okStoreScope && okCanPost()) okLoadRoster();
    }
    okMount.addEventListener("click", function (e) {
      var el = e.target;
      while (el && el !== okMount) {
        var action = el.getAttribute && el.getAttribute("data-ok-action");
        if (action) { okHandleAction(action, el); return; }
        el = el.parentNode;
      }
    });
    renderOshikome();
  }

  // データ取得 → レンダリング
  fetch(buildApiUrl(0)).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function (data) {
    // グループ API は store の代わりに group を返す (primary_color は系列共通色 or null)
    var s = data.store || data.group || {};
    var items = data.items || [];
    accent = safeColor(s.primary_color, dark ? "#14b8a6" : "#0d9488");
    hasMore = !!data.has_more;

    // ヘッダー: メンエスなうロゴのみを中央に配置（専有モードのためリンクにしない）
    // ダークは白抜きワードマーク(logo.svg)、ライトは全ピンク(logo-light.svg)で視認性を確保
    // 店舗が管理画面で OFF にしたときだけ丸ごと出さない (issue #1032)
    // featured は右ブロックにロゴロックアップを内蔵するので標準ヘッダーは出さない
    // (メンエスなうロゴがバナーの存在意義そのものなので brand_logo_enabled も適用しない)
    // oshikome もフッターに Powered by ロゴを内蔵するため標準ヘッダーは出さない
    var hdr = "";
    if (type !== "featured" && type !== "oshikome" && s.brand_logo_enabled !== false) {
      var logoFile = dark ? "logo.svg" : "logo-light.svg";
      hdr = '<div class="hdr">'
          + '<img class="hdr-brand" src="' + base + brandDir + logoFile + '" alt="メンエスなう">'
          + '</div>';
    }
    // 店舗が今日の案内を更新した時刻 (issue #1731)。一度も更新していない日は出さない
    if (type === "attendance" && data.guide_updated_at) {
      var upd = '<span class="hdr-upd"><i></i>案内状況 <span class="code">' + esc(data.guide_updated_at) + '</span> 更新</span>';
      hdr = hdr ? hdr.replace(/<\/div>$/, upd + '</div>') : '<div class="hdr" style="min-height:20px">' + upd + '</div>';
    }
    // 誰のタイムラインか分からないまま投稿が流れる状態を解消する (issue #794)
    if (type === "timeline" && data.therapist) hdr += renderTherapistHeader(data.therapist);

    // コンテンツ
    var body = "";
    if (type === "oshikome") {
      // 描画は initOshikome (list/form/done の3ビュー) が担う。
      // 0件時も独自の empty (投稿CTA付き) を出すので汎用 empty には落とさない
      body = "";
    } else if (items.length === 0 && type === "timeline" && data.profile) {
      // 投稿0件のセラピストは空箱の代わりにプロフィールで埋める (issue #1641)
      body = renderTherapistProfile(data.profile);
    } else if (items.length === 0 && type !== "featured") {
      var emptyMsg = type === "attendance" ? "本日の出勤情報はありません" : type === "staff" ? "セラピスト情報はありません" : type === "media" ? "写真はまだありません" : "投稿はまだありません";
      body = '<div class="empty">' + emptyMsg + '</div>';
    } else if (type === "featured") {
      // 大バナー (issue #1166)。公開セラピスト0の店でも店舗ブロックだけの縮退バナーを描く
      // (タグを貼った店で何も出ないよりよい)。配色はモック準拠のダーク固定
      var ft = data.featured || {};
      var ftUrl = safeUrl(ft.url || "/store/" + storePuid + "/");
      var ftN = items.length;
      var ftHasVip = items.some(function (it) { return it.is_vip; });
      var svgMag = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
      // 人差し指を立てた手。塗りのシルエットにして小サイズでも形が潰れないようにする
      var svgHand = '<svg class="ft-hand" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">'
                  + '<path d="M10.7 2.05c.94 0 1.7.76 1.7 1.7v6.3h.8V6.6a1.6 1.6 0 0 1 3.2 0v3.85h.8V8.75a1.6 1.6 0 0 1 3.2 0v7.5c0 3.2-2.35 5.6-5.55 5.6h-1.6c-2.02 0-3.63-.72-4.95-2.16l-3.5-3.82a1.72 1.72 0 0 1 2.4-2.45l1.8 1.55V3.75c0-.94.76-1.7 1.7-1.7z"/>'
                  + '</svg>';
      var svgShield = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';
      var svgMedal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/></svg>';
      var svgLock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      // 予約CTA (issue #1445)。バナーの外に足すと 1 枚絵の外の帯になって読み飛ばされるので、
      // 導線行の中に「掲載ページを見る」と並べる。出すかどうかはサーバ (data.cta) が決める。
      // 4:3 の詰め直しに使うので、行だけでなく枠にも印を付ける
      var ftBook = renderFeaturedCta(data.cta);
      body = '<div class="ft-wrap' + (ftBook ? ' has-book' : '') + '">';
      body += '<a class="ft-link" href="' + esc(ftUrl) + '" target="_blank" rel="noopener" aria-label="' + esc(s.name || "") + ' の掲載ページを見る"></a>';
      if (ftN > 0) {
        body += '<div class="ft-left"><div class="ft-stage">';
        items.forEach(function (it, i) {
          // 初期配置は保存順 (0=中央 / 1=左 / 2=右)。以降は bindFeatured が付け替える
          var pos = i === 0 ? "pos-c" : i === 1 && ftN === 3 ? "pos-l" : "pos-r";
          body += '<div class="ft-card ' + pos + '">';
          if (it.image) body += '<img src="' + esc(safeUrl(it.image)) + '" alt="">';
          else body += '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1c0a14">' + svgUser + '</div>';
          body += '<div class="grad"></div>';
          if (it.is_vip) body += '<span class="ft-vipband"><span>VIP</span></span>';
          body += '<div class="ft-info">';
          body += it.is_vip ? '<span class="ft-tag vip">VIP セラピスト</span>' : '<span class="ft-tag hot">注目セラピスト</span>';
          body += '<div class="ft-name">' + esc(it.name) + '</div>';
          var ftSpec = [it.age ? it.age + "歳" : "", it.height ? it.height + "cm" : "", it.cup ? it.cup + "カップ" : ""].filter(Boolean).join(" / ");
          if (ftSpec) body += '<div class="ft-spec code">' + esc(ftSpec) + '</div>';
          body += '<span class="ft-more">詳しく見る →</span></div>';
          body += '</div>';
        });
        body += '</div>';
        if (ftN > 1) {
          body += '<button class="ft-nav prev" type="button" aria-label="前のセラピスト">«</button>';
          body += '<button class="ft-nav next" type="button" aria-label="次のセラピスト">»</button>';
          body += '<div class="ft-flick">' + svgHand + '<span>フリックでチェック！</span></div>';
          body += '<div class="ft-swipe">‹&nbsp;&nbsp;左右にスワイプ&nbsp;&nbsp;›</div>';
        }
        body += '</div>';
      }
      body += '<div class="ft-right">';
      var ftName = s.name || "";
      // 全角を2文字ぶんとして数え、長い店名ほど小さく組む
      var ftNameW = ftName.replace(/[ -~｡-ﾟ]/g, "").length * 2 + ftName.replace(/[^ -~｡-ﾟ]/g, "").length;
      var ftLenCls = ftNameW > 44 ? " len-lg" : ftNameW > 26 ? " len-md" : "";
      body += '<div class="ft-lockup' + ftLenCls + '"><img class="ft-brand" src="' + base + brandDir + 'logo.svg" alt="メンエスなう">'
            + '<span class="ft-store"><span class="ft-x">×</span>' + esc(ftName) + '</span></div>';
      body += '<div class="ft-headline"><span class="ft-h1a">注目</span><span class="ft-h1b">掲載店</span></div>';
      // 出せるセラピストが 0 人の店で「在籍中」「今すぐ見つかる」と書くと
      // 設置先である店舗自身のサイトで事実と違う文言を出すことになるので、
      // 人がいないときは店舗の掲載そのものを訴求する文面に落とす
      var ftBadge = ftN === 0 ? "メンエスなう掲載店" : ftHasVip ? "人気VIP掲載中" : "人気セラピスト在籍中";
      var ftCopy = ftN === 0
        ? '<em>店舗情報</em>と<em>最新の出勤</em>をチェック！'
        : '<em>厳選セラピスト</em>が<em>今すぐ</em>見つかる！';
      body += '<div class="ft-goldbar"><span class="deco">─── ★</span><span>' + ftBadge + '</span><span class="deco">★ ───</span></div>';
      body += '<div class="ft-copy">' + ftCopy + '</div>';
      body += '<div class="ft-ctarow' + (ftBook ? ' has-book' : '') + '">'
            + '<span class="ft-cta">掲載ページを見る' + svgMag + '</span>' + ftBook
            + '<span class="ft-circle">今すぐ<span>チェック</span><span class="dn">▼</span></span></div>';
      // 注記は 1 行だけ。4:3 は高さが伸びないので、2 つ並べて折り返すと枠から溢れる。
      // cta.preview (設定 OFF のままのプレビュー) はまだ誰にも出ていないことを伝える印で、
      // 受付時間より先に知らせる必要があるので優先する
      var ftNote = data.cta && (data.cta.preview ? "デモ表示 — 設定を ON にすると公開されます" : esc(data.cta.phone_hint || ""));
      if (ftNote) body += '<div class="ft-ctanote">' + ftNote + '</div>';
      body += '<div class="ft-trust">'
            + '<span>' + svgShield + '安心・安全の運営体制</span>'
            + '<span>' + svgMedal + '厳選された高クオリティセラピスト</span>'
            + '<span>' + svgLock + 'プライバシー保護も万全</span>'
            + '</div>';
      body += '</div></div>';
    } else if (type === "attendance") {
      items.forEach(function (it, i) {
        var delay = "animation-delay:" + (i * 0.05) + "s";
        var working = it.status === "working";
        // バッジはサーバ側で確定済み (issue #1731)。badge の無い旧 API 応答は従来の判定
        var badge = it.badge || (working && it.instant ? "now" : working ? "duty" : "before");
        var dim = badge === "ended" || badge === "full";
        var edge = badge === "now" || badge === "next" ? accent : dim ? colors.fnt : working ? "#10b981" : "#f59e0b";
        // [DEMO] it.link (店舗HPのセラピスト詳細) があればカード全体をリンクにする (本番 API には無いデモ専用フィールド)
        body += '<' + (it.link ? 'a href="' + esc(it.link) + '"' : 'div') + ' class="att-card' + (dim ? ' dim' : '') + '" style="' + delay + '">';
        body += '<span class="att-edge" style="background:' + edge + '"></span>';
        body += '<div class="att-av">';
        if (it.image) body += '<img class="att-img" src="' + esc(safeUrl(it.image)) + '">';
        else body += '<div class="att-ph">' + svgUser + '</div>';
        if (working && !dim) body += '<span class="att-pulse"></span>';
        body += '</div>';
        body += '<div class="att-main">';
        body += '<div class="att-row1"><span class="att-who"><span class="att-name">' + esc(it.name) + '</span>';
        if (it.age) body += '<span class="att-age code">' + it.age + '歳</span>';
        body += '</span>';
        if (it.room_name) body += '<span class="att-room">' + svgPin + '<span>' + esc(it.room_name) + '</span></span>';
        body += '</div>';
        body += '<div class="att-row2">' + svgClock("currentColor");
        body += '<span class="att-time code">' + esc(it.start_time) + '〜' + esc(it.end_time) + '</span>';
        var spec = [it.height ? it.height + "cm" : "", it.cup ? it.cup + "カップ" : ""].filter(Boolean).join(" ");
        if (spec) body += '<span class="att-sep">·</span><span class="att-spec code">' + esc(spec) + '</span>';
        body += '</div>';
        if (it.catch_copy) body += '<div class="att-catch">“' + esc(it.catch_copy) + '”</div>';
        if (working && !dim && it.progress != null)
          body += '<div class="att-prog"><div class="att-prog-bar" style="width:' + it.progress + '%"></div></div>';
        body += '</div><div class="att-side">';
        if (badge === "ended") body += '<span class="att-badge full">受付終了</span>';
        else if (badge === "full") body += '<span class="att-badge full">本日満了</span>';
        else if (badge === "next") {
          body += '<span class="att-next" style="color:' + accent + '"><small>最短ご案内</small><b class="code">' + esc(it.next_available) + '<em>〜</em></b></span>';
          var wait = it.status === "scheduled" ? esc(it.start_time) + ' 出勤' : (it.next_wait_minutes != null ? 'あと' + it.next_wait_minutes + '分' : '');
          if (wait) body += '<span class="att-wait' + (it.status !== "scheduled" && it.next_wait_minutes <= 30 ? ' soon' : '') + '">' + wait + '</span>';
        }
        else if (badge === "now") body += '<span class="att-badge now" style="background:' + accent + '">' + svgBolt + '今すぐ可</span>';
        else if (badge === "duty") body += '<span class="att-badge duty"><span class="dot"></span>出勤中</span>';
        else body += '<span class="att-badge sched code">' + esc(it.start_time) + '〜</span>';
        body += '</div></' + (it.link ? 'a' : 'div') + '>';
      });
    } else if (type === "staff") {
      body = '<div class="staff-grid">';
      items.forEach(function (it, i) {
        var delay = "animation-delay:" + (i * 0.04) + "s";
        body += '<div class="staff-card" style="' + delay + '">';
        if (it.image) body += '<img src="' + esc(safeUrl(it.image)) + '">';
        else body += '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">' + svgUser + '</div>';
        body += '<div class="grad"></div>';
        body += staffBadge(it);
        body += '<div class="info"><p>' + esc(it.name);
        if (it.age) body += ' <span class="age code">' + it.age + '歳</span>';
        body += '</p>';
        if (it.start_time && it.end_time)
          body += '<div class="staff-time">' + svgClock("currentColor") + '<span class="code">' + esc(it.start_time) + '〜' + esc(it.end_time) + '</span></div>';
        var meta = [it.height ? it.height + "cm" : "", it.cup ? it.cup + "カップ" : ""].filter(Boolean).join(" ");
        if (meta) body += '<span class="code">' + esc(meta) + '</span>';
        body += '</div></div>';
      });
      body += '</div>';
    } else if (type === "schedule") {
      body = renderScheduleList(items);
    } else if (type === "media") {
      body = '<div class="media-grid">';
      items.forEach(function (it, i) {
        var delay = "animation-delay:" + (i * 0.04) + "s";
        body += '<div class="media-card" style="' + delay + '">';
        if (it.url) body += '<img data-src="' + esc(safeUrl(it.url)) + '" alt="">';
        else body += '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">' + svgUser + '</div>';
        if (it.caption) body += '<div class="cap">' + esc(it.caption) + '</div>';
        body += '</div>';
      });
      body += '</div>';
    } else if (type === "timeline") {
      items.forEach(function (it, i) { body += renderTimelineCard(it, i); });
      currentOffset = items.length;
      if (heightMode === "auto") {
        // 追加ロードしないので取得済みが全件。まだ続きがある場合は終端表示を出さない
        if (!hasMore && items.length > 0) body += endMarkup;
        hasMore = false;
      } else if (hasMore) {
        body += '<div class="tl-loader"><div class="spinner"></div></div>';
      } else if (items.length > 0) {
        body += endMarkup;
      }
    }

    var bodyCls = type === "timeline" ? "body tl" : type === "featured" ? "body ft" : "body";
    if (columns) bodyCls += " cols";
    // CTA は .root の末尾に置く。スクロール容器が .root 自身なので sticky が素直に効く
    ctaUrl = (data.cta && data.cta.url) || "";
    ctaNewTab = !!(data.cta && data.cta.new_tab);
    // 大バナーの CTA はバナー内 (.ft-book) に描いてあるので、共通の sticky ピルは足さない
    // (両方出すと [data-cta] が 2 つになり、bindCta が先頭しか拾えない)
    root.innerHTML = hdr + '<div class="' + bodyCls + '">' + body + '</div>'
                   + (type === "featured" ? "" : renderCta(data.cta));
    bodyEl = shadow.querySelector(".body");
    if (fill && type === "timeline" && data.therapist && bodyEl.firstElementChild && bodyEl.firstElementChild.className === "empty") root.classList.add("fill-empty");
    bindCta(root);
    setupTouchLock();
    if (type === "oshikome") initOshikome(data);
    if (type === "featured") {
      bindFeatured(shadow);
      // Shadow DOM 内の @media はビューポート基準で設置枠の幅を見られないため、
      // 複数カラム (packColumns) と同じく root 実幅で縦積みをトグルする
      var ftWrap = shadow.querySelector(".ft-wrap");
      if (ftWrap) {
        // --fts: 幅 1200px を等倍とする一括スケール係数。狭い枠では縦積み (.ft-stack) に
        // 切り替えたうえで、スマホ幅 (~430px) を基準にスケールし直す
        var applyFtStack = function () {
          var w = root.clientWidth;
          // 4:3 (issue #1286) は左右2列を組めるだけの幅があるときだけ。狭い枠で比率を
          // 守ると右列の字が読めなくなるので、480px 未満は比率を捨てて縦積みに戻す
          var r43 = ftRatio === "4:3" && w >= 480;
          var stacked = !r43 && w < 640;
          ftWrap.classList.toggle("ft-r43", r43);
          ftWrap.classList.toggle("ft-stack", stacked);
          ftWrap.classList.toggle("ft-narrow", !r43 && w < 900);
          // 縦積みは横幅いっぱいに積み上がるので、430px 基準だとスマホで各パーツが
          // 過大になりバナーが縦に伸びすぎる。470px 基準で少し落として詰める。
          // 4:3 は幅 600px を等倍とし、カードは高さ基準なので字の側だけ上限 1.35 で頭打ちにする
          var scale = r43 ? Math.min(1.35, Math.max(0.6, w / 600))
            : stacked ? Math.min(1.0, Math.max(0.68, w / 470)) : Math.min(1.1, Math.max(0.55, w / 1200));
          ftWrap.style.setProperty("--fts", scale.toFixed(3));
        };
        applyFtStack();
        if ("ResizeObserver" in window) new ResizeObserver(applyFtStack).observe(root);
      }
    }
    if (columns) {
      tlCards = [].slice.call(bodyEl.querySelectorAll(".tl-card"));
      packColumns();
    }
    // 幅が変わって段数が変わったときだけ組み直す (同じ段数なら packColumns は何もしない)。
    // 診断バーの px 表示は段数が変わらなくても更新するので packColumns とは独立に呼ぶ
    if ((columns || diagEl) && "ResizeObserver" in window) {
      new ResizeObserver(function () { packColumns(); updateDiag(); }).observe(root);
    }
    // 中身が入るとスクロールバーのぶん実幅が変わることがあるので描画後にも測り直す
    updateDiag();
    bindMoreButtons(shadow);
    observeLazyImages(shadow);
    setupInfiniteScroll();
  }).catch(function (e) {
    console.error("[MN Widget]", e);
    // グループの 404 (運営が無効化/削除) は管理画面の「非表示になります」の案内どおり
    // コンテナごと非表示にする。推しコメも同様: セラピストの退店 (自動同期 #1012 で
    // 日常的に非公開化される) や閉店は恒久的な 404 なので、店舗 HP に「読み込みに
    // 失敗しました」の箱を残し続けない。それ以外の失敗 (一時的なネットワーク断・5xx) は
    // 店舗ウィジェットと同じエラー表示を残し、障害を無言で握り潰さない
    if ((groupPuid || type === "oshikome") && /HTTP 404/.test(String(e && e.message))) {
      // 単体モードで畳むとオーバーレイが × だけの空パネルになる
      if (okCompose) {
        root.innerHTML = '<div class="empty">現在、推しコメの投稿を受け付けていません</div>';
        return;
      }
      host.style.display = "none";
      // host の display は root の MutationObserver に映らないので、fill の 0px 通知を直接促す
      if (fill) notifyContent();
      return;
    }
    root.innerHTML = '<div class="empty">ウィジェットの読み込みに失敗しました</div>';
  });
})();
