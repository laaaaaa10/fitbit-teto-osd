import clock from "clock";
import document from "document";
import { me as appbit } from "appbit";
import { HeartRateSensor } from "heart-rate";
import { today } from "user-activity";
import { display } from "display";
import { battery } from "power";

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────────────────────
// Drop more portraits next to teto.png and list them here. One is chosen at
// random every time you raise your wrist. Crop them like teto.png (same 225×300
// framing) so the left fade + layout still line up.
var IMAGES = [
  "teto.png"
  // , "teto2.png"
  // , "teto3.png"
];
// ─────────────────────────────────────────────────────────────────────────────

const DAYS   = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// pad2 replaces padStart — not supported in Fitbit's JS engine
function pad2(n) { return n < 10 ? "0" + n : "" + n; }

const dateTopEl = document.getElementById("date_top");
const dateDayEl = document.getElementById("date_day");
const hrValEl   = document.getElementById("hr_val");
const stepsEl   = document.getElementById("steps_val");
const calEl     = document.getElementById("cal_val");
const battFill  = document.getElementById("battery_fill");
const hTens     = document.getElementById("h_tens");
const hOnes     = document.getElementById("h_ones");
const mTens     = document.getElementById("m_tens");
const mOnes     = document.getElementById("m_ones");

// Elements for the wake animations
const tetoEl      = document.getElementById("teto");
const revealEl    = document.getElementById("reveal");
const timeGroupEl = document.getElementById("timeGroup");

function digit(n) { return "digits/" + n + ".png"; }

// ── Battery ───────────────────────────────────────────────────────────────────
const BATTERY_MAX_WIDTH = 30;
function updateBattery() {
  var pct   = battery.chargeLevel;
  var w     = Math.round((pct / 100) * BATTERY_MAX_WIDTH);
  var color = pct <= 20 ? "#FF3B30" : "#FF2D78";
  battFill.width       = w;
  battFill.style.width = w;
  battFill.style.fill  = color;
}
updateBattery();
battery.addEventListener("change", updateBattery);

// ── Activity ──────────────────────────────────────────────────────────────────
function updateActivity() {
  if (!appbit.permissions.granted("access_activity")) return;
  var a = today.adjusted;
  stepsEl.text = String(a.steps    || 0);
  calEl.text   = String(a.calories || 0);
}

// ── Random portrait on wake ─────────────────────────────────────────────────────
var currentImg = 0;
function pickRandomImage() {
  if (IMAGES.length <= 1) { return; }          // nothing to swap, skip the decode
  var next = currentImg;
  while (next === currentImg) {                 // never the same one twice in a row
    next = Math.floor(Math.random() * IMAGES.length);
  }
  currentImg = next;
  tetoEl.href = IMAGES[next];
}

// ── Wake animations (JavaScript-driven) ─────────────────────────────────────────
// These are driven entirely from JS via groupTransform, NOT SVG/SMIL animation.
// Why: a frozen SMIL animation holds its end value and wins over a manual reset,
// so on the next wake the finished frame paints for ~0.1s before the animation
// re-runs (the flash). Driving it ourselves means the resting state is whatever
// we last set — and the mask's geometry is built so x=0 fully COVERS the portrait,
// which is the start. So a wake paints "covered" first, then we slide it open.
//   reveal: groupTransform.translate.x  0 (covered)  -> -255 (revealed)
//   time:   groupTransform.translate.x  -14 (left)   ->    0 (in place)
var REVEAL_COVERED  = 0;
var REVEAL_OPEN     = -255;
var TIME_START      = -14;
var TIME_REST       = 0;
var ANIM_FRAMES     = 21;     // ~0.7s at the interval below
var ANIM_INTERVAL   = 33;     // ms per frame (~30fps)

var animTimer = null;
var animFrame = 0;

function easeOut(t) { return 1 - (1 - t) * (1 - t); }   // gentle deceleration

function setStartState() {
  // Park at the start: portrait fully covered, time slid left.
  if (revealEl)    { revealEl.groupTransform.translate.x    = REVEAL_COVERED; }
  if (timeGroupEl) { timeGroupEl.groupTransform.translate.x = TIME_START; }
}

function stopAnim() {
  if (animTimer !== null) { clearInterval(animTimer); animTimer = null; }
}

function playWakeAnimations() {
  stopAnim();
  setStartState();            // jump to covered / slid-left
  animFrame = 0;
  animTimer = setInterval(function() {
    animFrame++;
    var t = animFrame / ANIM_FRAMES;
    if (t > 1) { t = 1; }
    var e = easeOut(t);
    if (revealEl)    { revealEl.groupTransform.translate.x    = REVEAL_COVERED + (REVEAL_OPEN - REVEAL_COVERED) * e; }
    if (timeGroupEl) { timeGroupEl.groupTransform.translate.x = TIME_START     + (TIME_REST   - TIME_START)   * e; }
    if (animFrame >= ANIM_FRAMES) { stopAnim(); }
  }, ANIM_INTERVAL);
}

function resetWakeAnimations() {
  // On sleep: stop any in-progress slide and park at the start, so the next wake
  // shows "covered" first. No SMIL is involved, so this set actually sticks.
  stopAnim();
  setStartState();
}

// ── Clock ───────────────────────────────────────────────────────────────────────
clock.granularity = "minutes";
clock.addEventListener("tick", function(evt) {
  var date = evt.date;
  var h = date.getHours();
  var m = date.getMinutes();

  hTens.href = digit(Math.floor(h / 10));
  hOnes.href = digit(h % 10);
  mTens.href = digit(Math.floor(m / 10));
  mOnes.href = digit(m % 10);

  // pad2 instead of padStart — safe for Fitbit's JS engine
  dateTopEl.text = MONTHS[date.getMonth()] + " " + pad2(date.getDate());
  dateDayEl.text = DAYS[date.getDay()];
  updateActivity();
});

// ── Heart rate ──────────────────────────────────────────────────────────────────
var hrm = null;
if (appbit.permissions.granted("access_heart_rate")) {
  hrm = new HeartRateSensor({ frequency: 1 });
  hrm.addEventListener("reading", function() {
    hrValEl.text = hrm.heartRate ? String(hrm.heartRate) : "--";
  });
  hrm.start();
}

// ── Display power handling ───────────────────────────────────────────────────────
// On wake: restart the HR sensor and play the entrances. On sleep: stop the sensor
// AND re-park the animations at their start, so the next wake shows the start state
// (the fix for the 0.1s flash where the finished result showed before the animation).
function onDisplayChange() {
  if (display.on) {
    if (hrm) { hrm.start(); }
    pickRandomImage();        // fresh portrait (hidden behind the cover)...
    playWakeAnimations();     // ...wipes in from the right, time slides in too
  } else {
    if (hrm) { hrm.stop(); }
    resetWakeAnimations();    // re-cover the image + reset the time for next wake
  }
}
display.addEventListener("change", onDisplayChange);

// First paint: the GUI's resting state is already the START (covered image /
// slid-left time), so we just pick a portrait and play the entrance once.
pickRandomImage();
playWakeAnimations();