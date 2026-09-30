import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../js/game.js";
test("完整流程只收集四个不同季节，日時計卡依进度触发开场或结尾", () => {
  const g = new Game();
  assert.equal(g.recognize("sundial"), false);
  g.advance();
  assert.equal(g.recognize("spring"), false);
  assert.equal(g.recognize("sundial"), true);
  assert.equal(g.recognize("sundial"), false);
  g.advance();
  g.advance();
  assert.equal(g.form, "suit");
  g.advance();
  for (const id of ["spring", "summer", "autumn", "winter"]) {
    assert.equal(g.spot.id, id);
    assert.equal(g.recognize(id), true);
    assert.equal(g.recognize(id), false);
    g.advance();
    g.advance();
    assert.equal(g.fragments.has(id), true);
    g.advance();
  }
  assert.equal(g.fragments.size, 4);
  assert.equal(g.spot.id, "sundial");
  g.recognize("sundial");
  assert.equal(g.phase, "finale");
  g.advance();
  assert.equal(g.phase, "ended");
  assert.equal(g.form, "original");
});
test("识别丢失和重复回调不修改正在进行的事件；scan阶段按钮不能跳过识别", () => {
  const g = new Game();
  g.advance();
  g.advance();
  assert.equal(g.phase, "scan");
  assert.equal(g.recognize("winter"), false);
  g.recognize("sundial");
  for (let i = 0; i < 20; i++) g.recognize("sundial");
  assert.equal(g.phase, "opening-live");
  assert.equal(g.fragments.size, 0);
});
test("重开清除全部进度", () => {
  const g = new Game();
  g.debugFinal();
  g.recognize("sundial");
  g.advance();
  g.advance();
  assert.equal(g.phase, "tutorial");
  assert.equal(g.fragments.size, 0);
  assert.equal(g.spot.id, "sundial");
});
