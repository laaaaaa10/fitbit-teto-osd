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

// ── Wake animations ─────────────────────────────────────────────────────────────
// Both entrances are defined declaratively in index.gui (begin="enable"); we just
// fire them here. The portrait stays still while a black mask peels off it from
// right to left (so it wipes in from the right), and the time slides + fades in.
// Nothing animates while the screen is off, so battery is unaffected.
function playWakeAnimations() {
  if (revealEl)    { revealEl.animate("enable"); }     // portrait wipes in from the right
  if (timeGroupEl) { timeGroupEl.animate("enable"); }  // time slides + fades in
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

// ── Display power handling (stops the HR sensor while the screen is off) ─────────
function onDisplayChange() {
  if (display.on) {
    if (hrm) { hrm.start(); }
    pickRandomImage();        // fresh portrait...
    playWakeAnimations();     // ...wipes in from the right, time slides in too
  } else {
    if (hrm) { hrm.stop(); }
  }
}
display.addEventListener("change", onDisplayChange);

// First paint when the face loads
pickRandomImage();
playWakeAnimations();
