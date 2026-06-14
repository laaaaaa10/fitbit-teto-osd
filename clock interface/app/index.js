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
// Drop more character PNGs in the randomIMG folder and list them here. One is 
// chosen at random every time you raise your wrist.
var IMAGES = [
  "randomIMG/teto.png"
  // , "randomIMG/teto2.png"
  // , "randomIMG/teto3.png"
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
const characterEl = document.getElementById("character");
const fadeEl      = document.getElementById("fadeGroup");
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
  characterEl.href = IMAGES[next];
}

// ── Wake animations (JavaScript-driven) ─────────────────────────────────────────
// Fade.png is 600×300 (300px fade mask on left + 300px transparent on right).
// It slides from x=0 (covering character) to x=-300 (character fully revealed).
// Character image stays fixed while fade slides over it.
var REVEAL_COVERED  = 0;
var REVEAL_OPEN     = -300;
var TIME_START      = -14;
var TIME_REST       = 0;
var ANIM_FRAMES     = 10;     // ~0.35s at the interval below
var ANIM_INTERVAL   = 33;     // ms per frame (~30fps)

var animTimer = null;
var animFrame = 0;

function easeOut(t) { return 1 - (1 - t) * (1 - t); }   // gentle deceleration

function setStartState() {
  // Park at the start: fade fully covering, time slid left.
  if (fadeEl)      { fadeEl.groupTransform.translate.x      = REVEAL_COVERED; }
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
    if (fadeEl)      { fadeEl.groupTransform.translate.x      = REVEAL_COVERED + (REVEAL_OPEN - REVEAL_COVERED) * e; }
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
// AND re-park the animations at their start, so the next wake shows the start state.
function onDisplayChange() {
  if (display.on) {
    if (hrm) { hrm.start(); }
    pickRandomImage();        // pick a random character image
    playWakeAnimations();     // fade slides over it, time slides in
  } else {
    if (hrm) { hrm.stop(); }
    resetWakeAnimations();    // re-cover and reset for next wake
  }
}
display.addEventListener("change", onDisplayChange);

// First paint: pick a character and play the entrance animation.
pickRandomImage();
playWakeAnimations();