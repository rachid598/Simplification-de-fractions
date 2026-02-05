/* ============================================================
   FRAC-STRIKE — Game Engine
   ============================================================ */
(function () {
    'use strict';

    /* ========== CONFIGURATION ========== */
    var TOTAL_ROUNDS = 10;
    var ANIM = {
        DECOMPOSE_DELAY: 400,
        STRIKE_DELAY: 700,
        FADE_DELAY: 500,
        RESULT_DELAY: 450,
        NEXT_DELAY: 1400
    };

    /* ========== STATE ========== */
    var state = {
        level: 1,
        score: 0,
        combo: 0,
        maxCombo: 0,
        round: 0,
        steps: 0,
        perfectCount: 0,
        currentNum: 0,
        currentDen: 0,
        originalGCD: 0,
        animating: false,
        soundEnabled: true,
        roundResults: []
    };

    /* ========== DOM REFS ========== */
    var $;
    function cacheDom() {
        $ = {
            app:          document.getElementById('app'),
            menuScreen:   document.getElementById('menuScreen'),
            gameScreen:   document.getElementById('gameScreen'),
            resultScreen: document.getElementById('resultScreen'),
            playBtn:      document.getElementById('playBtn'),
            replayBtn:    document.getElementById('replayBtn'),
            menuBtn:      document.getElementById('menuBtn'),
            levelCards:   document.querySelectorAll('.level-card'),
            fracNum:      document.getElementById('fracNum'),
            fracDen:      document.getElementById('fracDen'),
            fraction:     document.getElementById('fraction'),
            fractionZone: document.getElementById('fractionZone'),
            divisorInput: document.getElementById('divisorInput'),
            validateBtn:  document.getElementById('validateBtn'),
            inputZone:    document.getElementById('inputZone'),
            feedback:     document.getElementById('feedback'),
            scoreValue:   document.getElementById('scoreValue'),
            comboValue:   document.getElementById('comboValue'),
            comboBadge:   document.getElementById('comboBadge'),
            roundValue:   document.getElementById('roundValue'),
            progressBar:  document.getElementById('progressBar'),
            helpBtn:      document.getElementById('helpBtn'),
            helpModal:    document.getElementById('helpModal'),
            closeHelp:    document.getElementById('closeHelp'),
            soundBtn:     document.getElementById('soundBtn'),
            soundIcon:    document.getElementById('soundIcon'),
            resultTitle:  document.getElementById('resultTitle'),
            resultStars:  document.getElementById('resultStars'),
            finalScore:   document.getElementById('finalScore'),
            resultStats:  document.getElementById('resultStats'),
            highScores:   document.getElementById('highScores')
        };
    }

    /* ========== AUDIO ENGINE (Web Audio API) ========== */
    var SoundFX = (function () {
        var ctx;
        function getCtx() {
            if (!ctx) {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (ctx.state === 'suspended') ctx.resume();
            return ctx;
        }

        function tone(freq, dur, type, vol) {
            if (!state.soundEnabled) return;
            try {
                var c = getCtx();
                var osc = c.createOscillator();
                var gain = c.createGain();
                osc.type = type || 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(vol || 0.18, c.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
                osc.connect(gain);
                gain.connect(c.destination);
                osc.start(c.currentTime);
                osc.stop(c.currentTime + dur);
            } catch (e) { /* silent fail */ }
        }

        return {
            click: function () { tone(800, 0.04, 'square', 0.08); },
            success: function () {
                tone(523, 0.12);
                setTimeout(function () { tone(659, 0.12); }, 80);
                setTimeout(function () { tone(784, 0.18); }, 160);
            },
            perfect: function () {
                tone(523, 0.1);
                setTimeout(function () { tone(659, 0.1); }, 70);
                setTimeout(function () { tone(784, 0.1); }, 140);
                setTimeout(function () { tone(1047, 0.25); }, 210);
            },
            error: function () { tone(220, 0.25, 'sawtooth', 0.12); },
            strike: function () { tone(400, 0.15, 'triangle', 0.1); },
            levelUp: function () {
                [523, 587, 659, 784, 1047].forEach(function (f, i) {
                    setTimeout(function () { tone(f, 0.12); }, i * 80);
                });
            }
        };
    })();

    /* ========== MATH UTILITIES ========== */
    function gcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b) {
            var t = b;
            b = a % t;
            a = t;
        }
        return a;
    }

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function generateFraction(level) {
        var targetNum, targetDen, factor;
        var attempts = 0;

        switch (level) {
            case 1:
                do {
                    targetNum = randInt(1, 9);
                    targetDen = randInt(2, 10);
                } while (targetNum >= targetDen || gcd(targetNum, targetDen) !== 1);
                factor = randInt(2, Math.min(10, Math.floor(99 / targetDen)));
                break;

            case 2:
                do {
                    targetNum = randInt(1, 5);
                    targetDen = randInt(2, 8);
                } while (targetNum >= targetDen || gcd(targetNum, targetDen) !== 1);
                var factors2 = [10, 25, 50];
                factor = factors2[randInt(0, factors2.length - 1)];
                break;

            case 3:
                do {
                    targetNum = randInt(2, 12);
                    targetDen = randInt(3, 18);
                    attempts++;
                } while ((targetNum >= targetDen || gcd(targetNum, targetDen) !== 1) && attempts < 200);
                if (targetNum >= targetDen || gcd(targetNum, targetDen) !== 1) {
                    targetNum = 3; targetDen = 7;
                }
                factor = randInt(2, Math.min(15, Math.floor(200 / targetDen)));
                break;

            default:
                targetNum = 1; targetDen = 2; factor = 2;
        }

        return {
            num: targetNum * factor,
            den: targetDen * factor,
            targetNum: targetNum,
            targetDen: targetDen,
            pgcd: factor
        };
    }

    /* ========== SCREEN MANAGEMENT ========== */
    function showScreen(id) {
        [$.menuScreen, $.gameScreen, $.resultScreen].forEach(function (s) {
            s.classList.remove('active');
        });
        document.getElementById(id).classList.add('active');
    }

    /* ========== FEEDBACK MESSAGES ========== */
    function showFeedback(msg, type, duration) {
        $.feedback.textContent = msg;
        $.feedback.className = 'feedback visible ' + (type || '');
        if (duration) {
            setTimeout(function () { clearFeedback(); }, duration);
        }
    }

    function clearFeedback() {
        $.feedback.className = 'feedback';
    }

    /* ========== PROGRESS BAR ========== */
    function initProgress() {
        $.progressBar.innerHTML = '';
        for (var i = 0; i < TOTAL_ROUNDS; i++) {
            var dot = document.createElement('div');
            dot.className = 'progress-dot';
            $.progressBar.appendChild(dot);
        }
    }

    function updateProgress() {
        var dots = $.progressBar.querySelectorAll('.progress-dot');
        for (var i = 0; i < dots.length; i++) {
            dots[i].className = 'progress-dot';
            if (i < state.round - 1) {
                dots[i].classList.add('done');
                if (state.roundResults[i] && state.roundResults[i].perfect) {
                    dots[i].classList.add('perfect-dot');
                }
            } else if (i === state.round - 1) {
                dots[i].classList.add('current');
            }
        }
    }

    /* ========== SCORE & COMBO ========== */
    function addScore(points) {
        var multiplier = Math.max(1, state.combo);
        var total = points * multiplier;
        state.score += total;
        $.scoreValue.textContent = state.score;
        $.scoreValue.classList.remove('bump');
        void $.scoreValue.offsetWidth;
        $.scoreValue.classList.add('bump');
    }

    function incrementCombo() {
        state.combo++;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
        updateComboDisplay();
    }

    function resetCombo() {
        state.combo = 0;
        updateComboDisplay();
    }

    function updateComboDisplay() {
        $.comboValue.textContent = 'x' + Math.max(1, state.combo);
        $.comboBadge.className = 'combo-badge';
        if (state.combo >= 5) {
            $.comboBadge.classList.add('fire');
        } else if (state.combo >= 3) {
            $.comboBadge.classList.add('hot');
        }
    }

    /* ========== FRACTION DISPLAY ========== */
    function showFraction(num, den, animate) {
        $.fracNum.innerHTML = '<span class="num-val">' + num + '</span>';
        $.fracDen.innerHTML = '<span class="den-val">' + den + '</span>';
        $.fracNum.classList.remove('decomposed');
        $.fracDen.classList.remove('decomposed');

        if (animate) {
            $.fraction.classList.remove('entrance');
            void $.fraction.offsetWidth;
            $.fraction.classList.add('entrance');
        }
    }

    /* ========== DECOMPOSITION ANIMATION ========== */
    function animateDecomposition(num, den, divisor, qNum, qDen, callback) {
        state.animating = true;
        $.validateBtn.disabled = true;

        /* Phase 1: Show decomposed form */
        var numHTML =
            '<span class="factor-group">' +
                '<span class="factor">' + divisor + '</span>' +
                '<span class="times">&times;</span>' +
            '</span>' +
            '<span class="quotient">' + qNum + '</span>';
        var denHTML =
            '<span class="factor-group">' +
                '<span class="factor">' + divisor + '</span>' +
                '<span class="times">&times;</span>' +
            '</span>' +
            '<span class="quotient">' + qDen + '</span>';

        $.fracNum.innerHTML = numHTML;
        $.fracDen.innerHTML = denHTML;
        $.fracNum.classList.add('decomposed');
        $.fracDen.classList.add('decomposed');

        /* Phase 2: Strike */
        setTimeout(function () {
            var groups = document.querySelectorAll('.factor-group');
            groups.forEach(function (g) { g.classList.add('struck'); });
            SoundFX.strike();
        }, ANIM.STRIKE_DELAY);

        /* Phase 3: Fade out */
        setTimeout(function () {
            var groups = document.querySelectorAll('.factor-group');
            groups.forEach(function (g) { g.classList.add('fade-out'); });
        }, ANIM.STRIKE_DELAY + ANIM.FADE_DELAY);

        /* Phase 4: Show clean result */
        setTimeout(function () {
            showFraction(qNum, qDen, false);
            $.fraction.classList.add('result-highlight');
            setTimeout(function () {
                $.fraction.classList.remove('result-highlight');
            }, 400);

            state.animating = false;
            $.validateBtn.disabled = false;
            callback();
        }, ANIM.STRIKE_DELAY + ANIM.FADE_DELAY + ANIM.RESULT_DELAY);
    }

    /* ========== GAME LOGIC ========== */
    function startGame() {
        state.score = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.round = 0;
        state.perfectCount = 0;
        state.roundResults = [];

        $.scoreValue.textContent = '0';
        updateComboDisplay();
        initProgress();
        showScreen('gameScreen');
        nextRound();
    }

    function nextRound() {
        state.round++;
        if (state.round > TOTAL_ROUNDS) {
            endGame();
            return;
        }

        state.steps = 0;
        $.roundValue.textContent = state.round;
        updateProgress();
        clearFeedback();

        var frac = generateFraction(state.level);
        state.currentNum = frac.num;
        state.currentDen = frac.den;
        state.originalGCD = frac.pgcd;

        showFraction(frac.num, frac.den, true);

        $.divisorInput.value = '';
        $.divisorInput.disabled = false;
        $.validateBtn.disabled = false;
        $.inputZone.classList.remove('hidden');

        setTimeout(function () {
            $.divisorInput.focus();
        }, 300);
    }

    function submitDivisor() {
        if (state.animating) return;

        var raw = $.divisorInput.value.trim();
        var d = parseInt(raw, 10);

        /* Validation */
        if (!raw || isNaN(d)) {
            shakeInput();
            showFeedback('Entre un nombre !', 'error', 2000);
            SoundFX.error();
            return;
        }

        if (d < 2) {
            shakeInput();
            showFeedback('Le diviseur doit être supérieur à 1', 'error', 2500);
            SoundFX.error();
            return;
        }

        if (state.currentNum % d !== 0 || state.currentDen % d !== 0) {
            shakeInput();
            showFeedback(d + ' ne divise pas ' + state.currentNum + ' et ' + state.currentDen, 'error', 2500);
            SoundFX.error();
            resetCombo();
            return;
        }

        /* Valid divisor */
        SoundFX.click();
        var qNum = state.currentNum / d;
        var qDen = state.currentDen / d;
        state.steps++;

        $.divisorInput.value = '';
        $.divisorInput.disabled = true;

        animateDecomposition(state.currentNum, state.currentDen, d, qNum, qDen, function () {
            state.currentNum = qNum;
            state.currentDen = qDen;

            if (gcd(qNum, qDen) === 1) {
                /* Fully simplified */
                var isPerfect = state.steps === 1;
                endRound(isPerfect);
            } else {
                /* Can simplify more */
                showFeedback('Continue ! Tu peux encore simplifier.', 'info', 2500);
                $.divisorInput.disabled = false;
                $.divisorInput.focus();
            }
        });
    }

    function endRound(isPerfect) {
        $.divisorInput.disabled = true;
        $.validateBtn.disabled = true;

        var basePoints = 100;

        if (isPerfect) {
            state.perfectCount++;
            addScore(basePoints + 200);
            incrementCombo();
            showFeedback('PERFECT !', 'perfect');
            SoundFX.perfect();
        } else {
            addScore(basePoints);
            incrementCombo();
            showFeedback('Bravo !', 'success');
            SoundFX.success();
        }

        state.roundResults.push({ perfect: isPerfect });
        updateProgress();

        setTimeout(function () {
            clearFeedback();
            nextRound();
        }, ANIM.NEXT_DELAY);
    }

    function endGame() {
        showScreen('resultScreen');
        SoundFX.levelUp();

        $.finalScore.textContent = state.score;

        /* Stars */
        var starCount = 1;
        if (state.score >= 800) starCount = 2;
        if (state.score >= 1500 || state.perfectCount === TOTAL_ROUNDS) starCount = 3;

        var starsHTML = '';
        for (var i = 0; i < 3; i++) {
            var earned = i < starCount ? ' earned' : '';
            var delay = i < starCount ? ' style="animation-delay: ' + (i * 0.2) + 's"' : '';
            starsHTML += '<span class="star' + earned + '"' + delay + '>&#9733;</span>';
        }
        $.resultStars.innerHTML = starsHTML;

        /* Title */
        if (starCount === 3) {
            $.resultTitle.textContent = 'Incroyable !';
        } else if (starCount === 2) {
            $.resultTitle.textContent = 'Bien joué !';
        } else {
            $.resultTitle.textContent = 'Terminé !';
        }

        /* Stats */
        var levelNames = ['', 'Débutant', 'Expert', 'Légende'];
        $.resultStats.innerHTML =
            '<div>Niveau : <span class="stat-highlight">' + levelNames[state.level] + '</span></div>' +
            '<div>Combo max : <span class="stat-highlight">x' + state.maxCombo + '</span></div>' +
            '<div>Perfect : <span class="stat-highlight">' + state.perfectCount + '/' + TOTAL_ROUNDS + '</span></div>';

        /* Save high score */
        saveHighScore(state.level, state.score);
    }

    function shakeInput() {
        $.divisorInput.classList.remove('shake');
        void $.divisorInput.offsetWidth;
        $.divisorInput.classList.add('shake');
    }

    /* ========== HIGH SCORES ========== */
    function saveHighScore(level, score) {
        try {
            var key = 'fracstrike_hs';
            var data = JSON.parse(localStorage.getItem(key) || '{}');
            if (!data[level] || score > data[level]) {
                data[level] = score;
                localStorage.setItem(key, JSON.stringify(data));
            }
        } catch (e) { /* silent */ }
    }

    function loadHighScores() {
        try {
            var key = 'fracstrike_hs';
            var data = JSON.parse(localStorage.getItem(key) || '{}');
            var names = { 1: 'Débutant', 2: 'Expert', 3: 'Légende' };
            var html = '';
            var hasScores = false;
            for (var lv = 1; lv <= 3; lv++) {
                if (data[lv]) {
                    hasScores = true;
                    html += '<div class="hs-item">' + names[lv] + ' : <span class="hs-value">' + data[lv] + '</span></div>';
                }
            }
            if (hasScores) {
                $.highScores.innerHTML = '<div style="margin-bottom:4px;font-weight:700;color:var(--gold);">Meilleurs scores</div>' + html;
            }
        } catch (e) { /* silent */ }
    }

    /* ========== EVENT BINDING ========== */
    function bindEvents() {
        /* Level selection */
        $.levelCards.forEach(function (card) {
            card.addEventListener('click', function () {
                $.levelCards.forEach(function (c) { c.classList.remove('selected'); });
                card.classList.add('selected');
                state.level = parseInt(card.getAttribute('data-level'), 10);
                SoundFX.click();
            });
        });

        /* Play */
        $.playBtn.addEventListener('click', function () {
            SoundFX.click();
            startGame();
        });

        /* Validate */
        $.validateBtn.addEventListener('click', function () {
            submitDivisor();
        });

        /* Enter key */
        $.divisorInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitDivisor();
            }
        });

        /* Replay */
        $.replayBtn.addEventListener('click', function () {
            SoundFX.click();
            startGame();
        });

        /* Menu */
        $.menuBtn.addEventListener('click', function () {
            SoundFX.click();
            showScreen('menuScreen');
            loadHighScores();
        });

        /* Help */
        $.helpBtn.addEventListener('click', function () {
            $.helpModal.classList.add('open');
        });
        $.closeHelp.addEventListener('click', function () {
            $.helpModal.classList.remove('open');
        });
        $.helpModal.querySelector('.modal-overlay').addEventListener('click', function () {
            $.helpModal.classList.remove('open');
        });

        /* Sound toggle */
        $.soundBtn.addEventListener('click', function () {
            state.soundEnabled = !state.soundEnabled;
            $.soundIcon.innerHTML = state.soundEnabled ? '&#128266;' : '&#128264;';
        });
    }

    /* ========== PWA SERVICE WORKER ========== */
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js').catch(function () {});
        }
    }

    /* ========== INIT ========== */
    function init() {
        cacheDom();
        bindEvents();
        loadHighScores();
        registerSW();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
