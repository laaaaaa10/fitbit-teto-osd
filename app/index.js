import clock from "clock";
import document from "document";
import { me as appbit } from "appbit";
import { HeartRateSensor } from "heart-rate";
import { today } from "user-activity";
import { display } from "display";
import { battery } from "power";

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

// ── Clock ─────────────────────────────────────────────────────────────────────
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

// ── Heart rate ────────────────────────────────────────────────────────────────
if (appbit.permissions.granted("access_heart_rate")) {
  var hrm = new HeartRateSensor({ frequency: 1 });
  hrm.addEventListener("reading", function() {
    hrValEl.text = hrm.heartRate ? String(hrm.heartRate) : "--";
  });
  display.addEventListener("change", function() {
    if (display.on) { hrm.start(); } else { hrm.stop(); }
  });
  hrm.start();
}