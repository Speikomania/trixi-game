// Erweiterung 14: is this a phone or tablet? Trixi needs a keyboard, and there is no touch version, so on those devices
// the page shows a friendly notice INSTEAD of downloading the game (that also saves the visitor's mobile data).
//
// Plain JavaScript without anything from the game package. classify() is a pure function (tested with Node:
// tools/webtest/device-check.test.mjs); readInfo() collects what the browser tells; the page calls both before it
// starts the game loader (index.html).
(function (root) {
    "use strict";

    // The texts of the notice – change them here.
    const TEXTS = {
        title: "Trixi braucht einen Computer",
        message: "Trixi läuft leider nur am Computer mit Tastatur. Bitte öffne diese Seite auf einem PC oder Laptop (Windows oder Chromebook).",
        sendHint: "Schick dir den Link, zum Beispiel per Mail oder Messenger:",
        copy: "Link kopieren",
        copied: "Kopiert!",
        copyFailed: "Bitte den Link oben von Hand kopieren.",
        tryAnyway: "Ich habe eine Tastatur angeschlossen – trotzdem versuchen",
    };

    /**
     * Decides from what the browser tells whether the visitor is on a phone or tablet. Several signs together, never
     * the user agent alone – and a computer is never blocked: Windows, Chromebooks (ChromeOS, also with a touch screen),
     * Linux and Macs without a touch screen always play. What counts is whether keyboard and mouse/touchpad are the main
     * input, which browsers show as a "fine" primary pointer that can hover.
     *
     * @param {object} info userAgent, maxTouchPoints, primaryPointer ("fine" | "coarse" | "none"), canHover,
     *   anyFinePointer, screenShort (shorter screen side in CSS pixels), uaMobile (navigator.userAgentData.mobile or null)
     * @returns {{ blocked: boolean, kind: "phone" | "tablet" | "computer", reason: string }}
     */
    function classify(info) {
        const ua = String(info.userAgent || "");
        const touchPoints = Number(info.maxTouchPoints) || 0;
        const keyboardAndMouse = info.primaryPointer === "fine" && info.canHover === true;

        const computer = (reason) => ({ blocked: false, kind: "computer", reason });
        const phone = (reason) => ({ blocked: true, kind: "phone", reason });
        const tablet = (reason) => ({ blocked: true, kind: "tablet", reason });

        // 1. Computers first – whatever else they report (touch screen laptops, Chromebooks in tablet mode).
        if (/CrOS/.test(ua)) {
            return computer("ChromeOS (Chromebook)");
        }
        if (/Windows NT/.test(ua) && !/Windows Phone/.test(ua)) {
            return computer("Windows");
        }

        // 2. iPadOS pretends to be a Mac ("Macintosh") – a real Mac has no touch screen.
        if (/Macintosh/.test(ua)) {
            return touchPoints > 1 ? tablet("iPad (reports itself as a Mac)") : computer("Mac");
        }

        // 3. Clear signs of a phone.
        if (info.uaMobile === true) {
            return phone("the browser says: mobile");
        }
        if (/iPhone|iPod|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua))) {
            return phone("phone user agent");
        }

        // 4. Tablets: iPad, Android without "Mobile", Kindle/Silk – unless a mouse is the main input (desktop mode).
        if (/iPad|Android|Silk|Kindle|PlayBook|Tablet/.test(ua)) {
            return keyboardAndMouse ? computer("tablet with mouse as main input") : tablet("tablet user agent");
        }

        // 5. Linux desktops and anything unknown: only a touch-only device with a small screen counts as mobile.
        const touchOnly = info.primaryPointer === "coarse" && info.canHover !== true && info.anyFinePointer !== true;
        if (touchOnly && touchPoints > 0 && Number(info.screenShort) > 0 && Number(info.screenShort) < 600) {
            return phone("small touch-only screen");
        }
        if (touchOnly && touchPoints > 0 && Number(info.screenShort) > 0 && Number(info.screenShort) < 1100) {
            return tablet("touch-only screen");
        }
        return computer(keyboardAndMouse ? "keyboard and mouse" : "no sign of a phone or tablet");
    }

    /** What this browser tells (for classify). */
    function readInfo(win) {
        const w = win || root;
        const nav = w.navigator || {};
        const media = (query) => !!(w.matchMedia && w.matchMedia(query).matches);
        const screen = w.screen || {};
        return {
            userAgent: nav.userAgent || "",
            maxTouchPoints: nav.maxTouchPoints || 0,
            primaryPointer: media("(pointer: fine)") ? "fine" : media("(pointer: coarse)") ? "coarse" : "none",
            canHover: media("(hover: hover)"),
            anyFinePointer: media("(any-pointer: fine)"),
            screenShort: Math.min(screen.width || 0, screen.height || 0),
            uaMobile: nav.userAgentData && typeof nav.userAgentData.mobile === "boolean" ? nav.userAgentData.mobile : null,
        };
    }

    const api = { TEXTS, classify, readInfo };
    root.TrixiDevice = api;
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
