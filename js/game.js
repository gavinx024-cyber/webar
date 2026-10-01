export const SPOTS = [
  { id: "sundial", name: "日時計", season: "はじまり", color: "#79b9f0" },
  {
    id: "spring",
    name: "バラ園",
    season: "春",
    color: "#f29bbb",
    title: "春の時間を咲かせよう",
    text: "止まった花びらに、時間の力を届けよう。",
    action: "花を咲かせる",
  },
  {
    id: "summer",
    name: "噴水",
    season: "夏",
    color: "#55cdeb",
    title: "水の時間を動かそう",
    text: "空中で止まった水を、もう一度流そう。",
    action: "水を流す",
  },
  {
    id: "autumn",
    name: "秋の木",
    season: "秋",
    color: "#ffc15a",
    title: "秋の風を呼び戻そう",
    text: "止まった葉に風を送り、季節を進めよう。",
    action: "風を送る",
  },
  {
    id: "winter",
    name: "石碑",
    season: "冬",
    color: "#c0acf8",
    title: "冬の記憶を目覚めさせよう",
    text: "静かな石碑に残る時間の波紋を、解き放とう。",
    action: "波紋を広げる",
  },
];
// Recognition sources only dispatch spot IDs; the game never depends on a tracker.
export class Game {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.reset();
  }
  reset() {
    this.phase = "tutorial";
    this.index = 0;
    this.fragments = new Set();
    this.history = [];
    this.cursor = -1;
    this.record();
    this.emit();
  }
  get replaying() {
    return this.cursor < this.history.length - 1;
  }
  get canGoBack() {
    return this.cursor > 0;
  }
  get storyFragmentCount() {
    return this.history[this.cursor]?.fragmentCount ?? this.fragments.size;
  }
  record() {
    this.history.push({
      phase: this.phase,
      index: this.index,
      fragmentCount: this.fragments.size,
    });
    this.cursor = this.history.length - 1;
  }
  restore(index) {
    this.cursor = index;
    this.phase = this.history[index].phase;
    this.index = this.history[index].index;
    this.emit();
  }
  back() {
    if (!this.canGoBack) return false;
    let index = this.cursor - 1;
    while (index > 0 && this.history[index].phase === "scan") index--;
    this.restore(index);
    return true;
  }
  get spot() {
    return SPOTS[this.index];
  }
  get form() {
    return ["tutorial", "opening-live", "opening-frozen", "ended"].includes(
      this.phase,
    ) ||
      (this.phase === "scan" &&
        this.index === 0 &&
        this.storyFragmentCount === 0)
      ? "original"
      : "suit";
  }
  emit() {
    this.onChange(this);
  }
  recognize(id) {
    if (this.replaying || this.phase !== "scan" || id !== this.spot.id)
      return false;
    this.phase =
      this.index === 0
        ? this.fragments.size === 4
          ? "finale"
          : "opening-live"
        : "event";
    this.record();
    this.emit();
    return true;
  }
  advance() {
    if (this.replaying) {
      let index = this.cursor + 1;
      while (
        index < this.history.length - 1 &&
        this.history[index].phase === "scan"
      )
        index++;
      this.restore(index);
      return;
    }
    switch (this.phase) {
      case "tutorial":
        this.phase = "scan";
        break;
      case "opening-live":
        this.phase = "opening-frozen";
        break;
      case "opening-frozen":
        this.phase = "transformed";
        break;
      case "transformed":
        this.index = 1;
        this.phase = "scan";
        break;
      case "event":
        this.phase = "restoring";
        break;
      case "restoring":
        this.fragments.add(this.spot.id);
        this.phase = "reward";
        break;
      case "reward":
        this.index = this.index === 4 ? 0 : this.index + 1;
        this.phase = "scan";
        break;
      case "finale":
        this.phase = "ended";
        break;
      case "ended":
        this.reset();
        return;
      default:
        return;
    }
    this.record();
    this.emit();
  }
  debugJump(id) {
    this.index = SPOTS.findIndex((s) => s.id === id);
    if (this.index < 0) this.index = 0;
    this.phase = "scan";
    this.history = [];
    this.record();
    this.emit();
  }
  debugFinal() {
    this.fragments = new Set(SPOTS.slice(1).map((s) => s.id));
    this.index = 0;
    this.phase = "scan";
    this.history = [];
    this.record();
    this.emit();
  }
}
export function dialogue(g) {
  const p = g.phase,
    s = g.spot;
  if (p === "tutorial")
    return {
      title: "こんにちは、ぼくは小H！",
      text: "5枚のカードで公園を巡ろう。日時計から出発して、春・夏・秋・冬の時間のかけらを集めたら、もう一度日時計へ。",
      button: "日時計へ進む",
    };
  if (p === "scan")
    return {
      title:
        g.fragments.size === 4 ? "日時計へ帰ろう" : `${s.name}のカードを探そう`,
      text: "カードの全体をカメラに映してください。認識すると物語が始まります。",
      button: null,
    };
  if (p === "opening-live")
    return {
      title: "公園の時間が動いている",
      text: "日時計の針と人影が、ゆっくり動いているよ。",
      button: "様子を見る",
    };
  if (p === "opening-frozen")
    return {
      title: "……時間が止まった！",
      text: "この公園の時間は、止まってしまった。ぼくと四季を巡って、4つの時間のかけらを取り戻そう！",
      button: "小Hと時間旅行へ",
    };
  if (p === "transformed")
    return {
      title: "時間旅行、出発！",
      text: "まずは春のバラ園へ。時間の力で、止まった季節を動かそう。",
      button: "春へ進む",
    };
  if (p === "event") return { title: s.title, text: s.text, button: s.action };
  if (p === "restoring")
    return {
      title: "時間が動き始めた！",
      text: "季節の中から、時間のかけらが現れたよ。",
      button: "かけらを受け取る",
    };
  if (p === "reward")
    return {
      title: "時間のかけらを見つけた！",
      text: `これで${g.storyFragmentCount}つ。${g.storyFragmentCount === 4 ? "4つ揃った！日時計へ戻ろう。" : "次の季節へ進もう。"}`,
      button: g.storyFragmentCount === 4 ? "日時計へ戻る" : "次の季節へ",
    };
  if (p === "finale")
    return {
      title: "4つの時間を、ひとつに",
      text: "春、夏、秋、冬のかけらが集まり、公園の時間がもう一度流れ出す。",
      button: "時間を取り戻す",
    };
  return {
    title: "おめでとうございます！",
    text: "4つのかけらを集め、公園の時間を取り戻しました。ありがとう！これで時間旅行はおしまい。前の場面も、もう一度楽しめるよ。",
    button: "最初の画面へ",
  };
}
