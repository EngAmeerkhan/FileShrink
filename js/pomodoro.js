/**
 * FileShrink - Pomodoro Timer Engine (/js/pomodoro.js)
 * High-accuracy timestamp-driven timer (Date.now) with Web Audio chime,
 * Wake Lock API, and resilient storage handling.
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. DEFAULT CONFIGURATION & STORAGE
     ========================================================================== */
  const DEFAULT_SETTINGS = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
    soundEnabled: true,
    wakeLockEnabled: false
  };

  const STORAGE_KEY = 'fileshrink_pomodoro_settings';

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(saved));
      }
    } catch (e) {
      // Storage blocked in strict privacy mode
    }
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // Storage blocked
    }
  }

  /* ==========================================================================
     2. WEB AUDIO API CHIME (Zero external audio assets)
     ========================================================================== */
  function playCompletionChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      // Tone 1: 587.33 Hz (D5) -> Tone 2: 880 Hz (A5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.85);
    } catch (e) {
      // Audio not permitted or failed
    }
  }

  /* ==========================================================================
     3. WAKE LOCK API
     ========================================================================== */
  let wakeLockSentinel = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
    } catch (err) {
      wakeLockSentinel = null;
    }
  }

  function releaseWakeLock() {
    try {
      if (wakeLockSentinel) {
        wakeLockSentinel.release();
        wakeLockSentinel = null;
      }
    } catch (err) {}
  }

  /* ==========================================================================
     4. POMODORO STATE & CORE LOGIC
     ========================================================================== */
  function initPomodoroTimer() {
    // DOM Elements
    const timerDisplay = document.getElementById('timerDisplay');
    const startPauseBtn = document.getElementById('startPauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const skipBtn = document.getElementById('skipBtn');
    const sessionInfoBadge = document.getElementById('sessionInfoBadge');
    const modeBtns = document.querySelectorAll('.pomodoro-mode-btn');

    // Settings inputs
    const settingsToggleBtn = document.getElementById('settingsToggleBtn');
    const settingsBox = document.getElementById('settingsBox');
    const focusMinInput = document.getElementById('focusMinInput');
    const shortBreakMinInput = document.getElementById('shortBreakMinInput');
    const longBreakMinInput = document.getElementById('longBreakMinInput');
    const intervalInput = document.getElementById('intervalInput');
    const soundToggle = document.getElementById('soundToggle');
    const notifToggleBtn = document.getElementById('notifToggleBtn');
    const wakeLockGroup = document.getElementById('wakeLockGroup');
    const wakeLockToggle = document.getElementById('wakeLockToggle');

    if (!timerDisplay || !startPauseBtn) return;

    let settings = loadSettings();
    let currentMode = 'focus'; // 'focus' | 'shortBreak' | 'longBreak'
    let isRunning = false;
    let targetEndTime = 0;
    let timeRemainingMs = settings.focusMinutes * 60 * 1000;
    let timerInterval = null;
    let focusSessionIndex = 1; // Current cycle session (1 to interval)
    let completedSessionsTotal = 0;

    // Check Wake Lock support
    if (wakeLockGroup) {
      if (!('wakeLock' in navigator)) {
        wakeLockGroup.style.display = 'none';
      }
    }

    // Populate settings inputs
    function syncSettingsInputs() {
      if (focusMinInput) focusMinInput.value = settings.focusMinutes;
      if (shortBreakMinInput) shortBreakMinInput.value = settings.shortBreakMinutes;
      if (longBreakMinInput) longBreakMinInput.value = settings.longBreakMinutes;
      if (intervalInput) intervalInput.value = settings.longBreakInterval;
      if (soundToggle) soundToggle.checked = settings.soundEnabled;
      if (wakeLockToggle) wakeLockToggle.checked = settings.wakeLockEnabled;
    }
    syncSettingsInputs();

    // Notification permission status
    function updateNotifButtonStatus() {
      if (!notifToggleBtn) return;
      if (!('Notification' in window)) {
        notifToggleBtn.style.display = 'none';
        return;
      }
      if (Notification.permission === 'granted') {
        notifToggleBtn.textContent = 'Notifications Enabled ✓';
        notifToggleBtn.disabled = true;
        notifToggleBtn.style.opacity = '0.7';
      } else {
        notifToggleBtn.textContent = 'Enable Notifications';
        notifToggleBtn.disabled = false;
        notifToggleBtn.style.opacity = '1';
      }
    }
    updateNotifButtonStatus();

    if (notifToggleBtn) {
      notifToggleBtn.addEventListener('click', () => {
        if ('Notification' in window) {
          Notification.requestPermission().then(() => {
            updateNotifButtonStatus();
          });
        }
      });
    }

    // Settings Toggle
    if (settingsToggleBtn && settingsBox) {
      settingsToggleBtn.addEventListener('click', () => {
        const isHidden = settingsBox.style.display === 'none';
        settingsBox.style.display = isHidden ? 'block' : 'none';
        settingsToggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });
    }

    // Save inputs on change
    function onSettingsChanged() {
      const f = parseInt(focusMinInput.value, 10);
      const sb = parseInt(shortBreakMinInput.value, 10);
      const lb = parseInt(longBreakMinInput.value, 10);
      const iv = parseInt(intervalInput.value, 10);

      settings.focusMinutes = (!isNaN(f) && f > 0) ? f : 25;
      settings.shortBreakMinutes = (!isNaN(sb) && sb > 0) ? sb : 5;
      settings.longBreakMinutes = (!isNaN(lb) && lb > 0) ? lb : 15;
      settings.longBreakInterval = (!isNaN(iv) && iv > 0) ? iv : 4;
      settings.soundEnabled = soundToggle ? soundToggle.checked : true;
      settings.wakeLockEnabled = wakeLockToggle ? wakeLockToggle.checked : false;

      saveSettings(settings);

      // If timer is stopped, reset current mode duration
      if (!isRunning) {
        setMode(currentMode, false);
      }
    }

    [focusMinInput, shortBreakMinInput, longBreakMinInput, intervalInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('change', onSettingsChanged);
        inp.addEventListener('input', onSettingsChanged);
      }
    });
    if (soundToggle) soundToggle.addEventListener('change', onSettingsChanged);
    if (wakeLockToggle) {
      wakeLockToggle.addEventListener('change', () => {
        onSettingsChanged();
        if (isRunning && settings.wakeLockEnabled) {
          requestWakeLock();
        } else {
          releaseWakeLock();
        }
      });
    }

    // Format mm:ss
    function formatTime(ms) {
      const totalSec = Math.ceil(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Update Display & Tab Title
    function renderDisplay() {
      const timeStr = formatTime(timeRemainingMs);
      timerDisplay.textContent = timeStr;

      // Update page title
      if (isRunning) {
        const modeLabel = currentMode === 'focus' ? 'Focus' : 'Break';
        document.title = `(${timeStr}) ${modeLabel} - Pomodoro Timer | FileShrink`;
      } else {
        document.title = 'Pomodoro Timer - Free Online | FileShrink';
      }

      // Update badge
      if (sessionInfoBadge) {
        if (currentMode === 'focus') {
          sessionInfoBadge.textContent = `Focus Session ${focusSessionIndex} of ${settings.longBreakInterval}`;
        } else if (currentMode === 'shortBreak') {
          sessionInfoBadge.textContent = `Short Break (${settings.shortBreakMinutes}m)`;
        } else {
          sessionInfoBadge.textContent = `Long Break (${settings.longBreakMinutes}m)`;
        }
      }
    }

    // Set Mode
    function setMode(mode, autoStart = false) {
      currentMode = mode;
      pauseTimer();

      modeBtns.forEach(btn => {
        if (btn.getAttribute('data-mode') === mode) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      let minutes = settings.focusMinutes;
      if (mode === 'shortBreak') minutes = settings.shortBreakMinutes;
      if (mode === 'longBreak') minutes = settings.longBreakMinutes;

      timeRemainingMs = minutes * 60 * 1000;
      renderDisplay();

      if (autoStart) {
        startTimer();
      }
    }

    modeBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const m = this.getAttribute('data-mode');
        setMode(m, false);
      });
    });

    // Start Timer
    function startTimer() {
      if (isRunning) return;
      isRunning = true;
      targetEndTime = Date.now() + timeRemainingMs;

      startPauseBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        Pause
      `;
      startPauseBtn.classList.remove('btn-primary');
      startPauseBtn.classList.add('btn-secondary');

      if (settings.wakeLockEnabled) {
        requestWakeLock();
      }

      // High precision tick interval
      clearInterval(timerInterval);
      timerInterval = setInterval(tick, 100);
      renderDisplay();
    }

    // Pause Timer
    function pauseTimer() {
      if (!isRunning) return;
      isRunning = false;
      timeRemainingMs = Math.max(0, targetEndTime - Date.now());
      clearInterval(timerInterval);

      startPauseBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Start
      `;
      startPauseBtn.classList.remove('btn-secondary');
      startPauseBtn.classList.add('btn-primary');

      releaseWakeLock();
      renderDisplay();
    }

    // Tick
    function tick() {
      const now = Date.now();
      timeRemainingMs = Math.max(0, targetEndTime - now);
      renderDisplay();

      if (timeRemainingMs <= 0) {
        onTimerComplete();
      }
    }

    // Completion Handler
    function onTimerComplete() {
      pauseTimer();

      if (settings.soundEnabled) {
        playCompletionChime();
      }

      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const msg = currentMode === 'focus'
          ? 'Great job! Time for a well-deserved break.'
          : 'Break finished! Ready to focus again?';
        try {
          new Notification('Pomodoro Timer', {
            body: msg,
            icon: '/favicon.svg'
          });
        } catch (e) {}
      }

      if (currentMode === 'focus') {
        completedSessionsTotal++;
        if (completedSessionsTotal % settings.longBreakInterval === 0) {
          focusSessionIndex = 1;
          setMode('longBreak', true);
        } else {
          focusSessionIndex++;
          setMode('shortBreak', true);
        }
      } else {
        setMode('focus', true);
      }
    }

    // Reset Timer
    function resetTimer() {
      pauseTimer();
      let minutes = settings.focusMinutes;
      if (currentMode === 'shortBreak') minutes = settings.shortBreakMinutes;
      if (currentMode === 'longBreak') minutes = settings.longBreakMinutes;
      timeRemainingMs = minutes * 60 * 1000;
      renderDisplay();
    }

    // Skip Timer
    function skipTimer() {
      pauseTimer();
      if (currentMode === 'focus') {
        completedSessionsTotal++;
        if (completedSessionsTotal % settings.longBreakInterval === 0) {
          focusSessionIndex = 1;
          setMode('longBreak', false);
        } else {
          focusSessionIndex++;
          setMode('shortBreak', false);
        }
      } else {
        setMode('focus', false);
      }
    }

    // Button event handlers
    startPauseBtn.addEventListener('click', () => {
      if (isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    });

    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
    if (skipBtn) skipBtn.addEventListener('click', skipTimer);

    // Initial render
    setMode('focus', false);

    // Tab visibility handling: sync immediately when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isRunning) {
        tick();
      }
    });
  }

  window.initPomodoroTimer = initPomodoroTimer;

})();
