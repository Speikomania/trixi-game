// Browser glue for Trixi. Everything game-related runs in .NET (WebAssembly); this file only
// covers what a web page has to do itself.
(function () {
    "use strict";

    // Browsers start audio "suspended" until the player interacts with the page. Remember every audio
    // context the game creates and wake it up on the next click or key press.
    const contexts = [];
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    if (NativeAudioContext) {
        const Tracked = function (...args) {
            const context = new NativeAudioContext(...args);
            contexts.push(context);
            return context;
        };
        Tracked.prototype = NativeAudioContext.prototype;
        window.AudioContext = Tracked;
    }
    function resumeAudio() {
        for (const context of contexts) {
            if (context.state === "suspended") {
                context.resume();
            }
        }
    }
    window.addEventListener("keydown", resumeAudio, true);
    window.addEventListener("pointerdown", resumeAudio, true);

    // Arrow keys and space would otherwise scroll the page (e.g. when embedded). On the start screen,
    // Enter or space presses the big "Spielen" button.
    const gameKeys = [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    window.addEventListener("keydown", function (event) {
        const play = document.querySelector(".overlay .play");
        if (play && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            play.click();
            return;
        }
        if (gameKeys.includes(event.key)) {
            event.preventDefault();
        }
    });

    // Version 2, Erweiterung 4: characters typed by the player (name field) – the browser knows the keyboard layout,
    // so the key's text is taken as it is ("ö", "Ä", ...). Enter becomes "\r". The game takes them once per frame.
    let typed = "";
    window.addEventListener("keydown", function (event) {
        if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
            return;
        }
        if (event.key === "Enter") {
            typed += "\r";
        } else if (event.key.length === 1) {
            typed += event.key;
        }
        if (typed.length > 64) {
            typed = typed.slice(-64);
        }
    });

    function tick() {
        window.trixi.instance.invokeMethod("TickDotNet");
        window.requestAnimationFrame(tick);
    }

    window.trixi = {
        instance: null,

        hasWebGL: function () {
            try {
                const probe = document.createElement("canvas");
                return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
            } catch (e) {
                return false;
            }
        },

        // Size the canvas to the page and give it the keyboard focus; returns [width, height].
        prepareCanvas: function () {
            const canvas = document.getElementById("theCanvas");
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            canvas.addEventListener("contextmenu", e => e.preventDefault());
            canvas.focus();
            resumeAudio();
            return [canvas.width, canvas.height];
        },

        startLoop: function (instance) {
            window.trixi.instance = instance;
            window.requestAnimationFrame(tick);
        },

        // "?perf" in the address: the game logs frame rate and timings to the developer console (F12).
        wantsPerformanceLog: function () {
            return new URLSearchParams(location.search).has("perf");
        },

        // "?mute" in the address (used by the browser tests): "Alles stumm" is forced, settings stay unchanged.
        wantsMute: function () {
            return new URLSearchParams(location.search).has("mute");
        },

        // "?offline" in the address (used by the browser tests): no online sync, no leaderboard entries.
        wantsOffline: function () {
            return new URLSearchParams(location.search).has("offline");
        },

        drainTyped: function () {
            const text = typed;
            typed = "";
            return text;
        },

        // Diagnostics for the browser tests: "running" means sound can be heard.
        audioStates: function () {
            return contexts.map(c => c.state);
        },

        showCrash: function () {
            document.getElementById("crash").hidden = false;
        },

        storageGet: function (key) {
            return window.localStorage.getItem(key);
        },

        storageSet: function (key, value) {
            window.localStorage.setItem(key, value);
        },
    };
})();
