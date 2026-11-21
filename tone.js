// Tone Helper — runs entirely in the browser, no API needed.
// analyze(text) flags risky phrasing; rewrite(text, tone, seed) returns a reworded version.
(function () {
  const TONES = [
    { id: "warm", label: "Warmer", icon: "🤗", desc: "Softer, more affectionate" },
    { id: "calm", label: "Calmer", icon: "🌊", desc: "De-escalate, less heat" },
    { id: "apologetic", label: "Apologetic", icon: "🙏", desc: "Own it, take responsibility" },
    { id: "supportive", label: "Supportive", icon: "🫂", desc: "Comforting, on her side" },
    { id: "direct", label: "Clear & direct", icon: "🎯", desc: "Say what you mean, kindly" },
    { id: "playful", label: "Playful", icon: "😜", desc: "Lighter, fun" },
    { id: "flirty", label: "Flirty", icon: "😏", desc: "A little spicy" }
  ];

  // Phrases that tend to escalate, with softer swaps (used by most tones)
  const SOFTEN = [
    [/\byou never\b/gi, "it feels like you don't"],
    [/\byou always\b/gi, "it feels like you often"],
    [/\byou made me\b/gi, "I felt"],
    [/\byou make me\b/gi, "I feel"],
    [/\byou need to\b/gi, "could you"],
    [/\byou have to\b/gi, "could you"],
    [/\byou should have\b/gi, "I wish you had"],
    [/\byou should\b/gi, "maybe you could"],
    [/\bwhy didn'?t you\b/gi, "I was hoping you would"],
    [/\bwhy would you\b/gi, "help me understand why you'd"],
    [/\bwhat'?s your problem\??/gi, "is something bothering you?"],
    [/\bcalm down\b/gi, "let's take a breath"],
    [/\bi don'?t care\b/gi, "either is okay with me"],
    [/\bshut up\b/gi, "hold on"],
    [/\bwhatever\b/gi, "okay"],
    [/\bstupid\b/gi, "frustrating"],
    [/\bridiculous\b/gi, "hard for me"],
    [/\bannoying\b/gi, "frustrating"],
    [/\bi'?m done\b/gi, "I need a little break"],
    [/\bforget it\b/gi, "let's talk about it later"],
    [/\bfine\b/gi, "okay"],
    [/\bobviously\b/gi, ""],
    [/\bseriously\b/gi, ""],
    [/\bliterally\b/gi, ""],
    [/\bagain\?/gi, "?"],
    [/\bsorry,? but\b/gi, "sorry —"]
  ];
  const HEDGES = [/\bi guess\b,?/gi, /\bkind of\b/gi, /\bsort of\b/gi, /\bjust\b/gi, /\bmaybe\b,?/gi, /\bkinda\b/gi, /\bi mean\b,?/gi, /\bno worries if not\b/gi, /\bif that'?s okay\b/gi];

  const DRY = /^(k|kk|ok|okay|fine|sure|cool|whatever|ya|yeah|yep|np|lol|mhm|idk)[.!]*$/i;

  const WRAP = {
    warm:       { open: ["Hey love,", "Hey {name},", "Babe,", ""], close: ["❤️", "Love you.", "🫶", "💛"] },
    calm:       { open: ["Hey,", "", "I hear you.", "Hey {name},"], close: ["Can we talk about it when we're both ready?", "I love you, even when we disagree.", "We're okay.", ""] },
    apologetic: { open: ["I'm sorry.", "You're right, and I'm sorry.", "I owe you an apology.", "I messed up, and I'm sorry."], close: ["I'll do better.", "I want to make it right.", "Thank you for telling me how you felt.", "I love you, and I'm working on it."] },
    supportive: { open: ["I'm here for you.", "That sounds really hard.", "I've got you.", "I'm so sorry you're dealing with this."], close: ["Whatever you need, I'm here.", "Want me to call?", "You don't have to go through this alone.", "Proud of you for handling it."] },
    direct:     { open: [""], close: [""] },
    playful:    { open: ["Okay so,", "Hear me out:", "Breaking news:", ""], close: ["😜", "hehe", "😂", "🙃"] },
    flirty:     { open: ["Hey cutie,", "Hey gorgeous,", "So…", "Hey you,"], close: ["😏", "😘", "Just saying 😉", "🔥"] }
  };

  const DRY_REPLIES = {
    warm: "Okay, sounds good! Thanks for letting me know ❤️",
    calm: "Okay. I hear you — let's talk more when we're both ready.",
    apologetic: "Okay. Sorry if I seemed short — I'm here.",
    supportive: "Okay, I'm here if you need anything at all.",
    direct: "Okay, sounds good.",
    playful: "Okayyy deal 😜",
    flirty: "Okay… but only because it's you 😏"
  };

  function pick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }

  function deCap(text) {
    // turn SHOUTED text into normal case
    const letters = text.replace(/[^A-Za-z]/g, "");
    const upper = text.replace(/[^A-Z]/g, "");
    if (letters.length > 5 && upper.length / letters.length > 0.6) return text.toLowerCase();
    return text.replace(/\b[A-Z][A-Z']+\b/g, w => (w === "OK" || w === "TV" ? w : w.toLowerCase()));
  }

  function tidy(text) {
    let t = text
      .replace(/!{2,}/g, "!")
      .replace(/\?{2,}/g, "?")
      .replace(/[?!]{2,}/g, "?")
      .replace(/\.{4,}/g, "…")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/,\s*,/g, ",")
      .replace(/\s{2,}/g, " ")
      .replace(/^\s*[,.]\s*/, "")
      .trim();
    // capitalize start of each sentence
    t = t.replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
    t = t.replace(/\bi\b/g, "I").replace(/\bim\b/gi, "I'm").replace(/\bdont\b/gi, "don't").replace(/\bcant\b/gi, "can't");
    if (t && !/[.!?…)\]"'\u{1F300}-\u{1FAFF}☀-➿]$/u.test(t)) t += ".";
    return t;
  }

  function rewrite(text, tone, seed = 0, name = "") {
    const raw = (text || "").trim();
    if (!raw) return "";
    const nm = name || "babe";
    const fill = s => s.replace(/\{name\}/g, nm);

    if (DRY.test(raw)) return fill(DRY_REPLIES[tone] || raw);

    let t = deCap(raw);

    if (tone === "direct") {
      t = t.replace(/\bsorry,? but\b/gi, "sorry —").replace(/\byou made me\b/gi, "I felt").replace(/\byou make me\b/gi, "I feel");
      HEDGES.forEach(h => { t = t.replace(h, ""); });
      t = t.replace(/\byou never\b/gi, "I'd like you to").replace(/\byou always\b/gi, "I've noticed you often");
      t = t.replace(/\bwhatever\b/gi, "okay").replace(/\bfine\b/gi, "okay");
      return tidy(t);
    }

    if (tone !== "playful" && tone !== "flirty") {
      SOFTEN.forEach(([re, rep]) => { t = t.replace(re, rep); });
    } else {
      // keep the vibe light: just drop the sharpest edges
      SOFTEN.slice(0, 12).forEach(([re, rep]) => { t = t.replace(re, rep); });
    }

    if (tone === "calm") t = t.replace(/!+/g, ".");
    if (tone === "apologetic") t = t.replace(/\bsorry,? but\b/gi, "sorry —").replace(/\bif you\b/gi, "that you");

    t = tidy(t);
    const w = WRAP[tone] || WRAP.warm;
    const open = fill(pick(w.open, seed));
    const close = fill(pick(w.close, seed + 1));
    // lowercase first letter after an opener that ends in a comma
    if (open && open.endsWith(",") && t) t = t[0].toLowerCase() + t.slice(1);
    t = t.replace(/^i\b/, "I");
    return [open, t, close].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
  }

  function analyze(text) {
    const t = (text || "").trim();
    const flags = [];
    if (!t) return flags;
    const add = (level, title, tip) => flags.push({ level, title, tip });

    if (/\byou (always|never)\b/i.test(t)) add("warn", "Absolutes: “always / never”", "These feel like an attack on who she is. Try describing one specific moment instead.");
    if (/\byou (made|make) me\b/i.test(t)) add("warn", "Blame framing", "Swap to an I-statement: “I felt ___ when ___.”");
    if (/\b(you need to|you have to|you should)\b/i.test(t)) add("warn", "Sounds like an order", "Turn it into a request: “Could you…?” or “Would you be up for…?”");
    if (/\b(whatever|i don'?t care|forget it|i'?m done|fine\.?$)\b/i.test(t)) add("warn", "Dismissive phrase", "These shut the conversation down. Say what you actually feel, even if it's “I'm frustrated and need a minute.”");
    if (/\b(calm down|relax|overreacting|dramatic|crazy)\b/i.test(t)) add("warn", "Invalidating words", "Telling someone to calm down almost never calms them down. Try “I can tell this really upset you.”");
    if (/\b[A-Z]{3,}\b/.test(t) && t.replace(/[^A-Z]/g, "").length > 6) add("warn", "ALL CAPS reads as yelling", "Lowercase it — let the words carry the weight.");
    if (/[!?]{2,}/.test(t)) add("warn", "Stacked punctuation", "“??” or “!!!” can read as angry or sarcastic over text.");
    if (/\b(why didn'?t you|why would you|what'?s your problem)\b/i.test(t)) add("warn", "Accusing question", "Questions that start with “why didn't you” feel like a trap. Try “I was hoping…”.");
    if (/\b(lol|lmao|haha)\b/i.test(t) && /\b(you|whatever|fine|okay)\b/i.test(t) && t.length < 40) add("warn", "Could read as sarcastic", "Short replies with “lol” can feel passive-aggressive in a tense moment.");
    if (/\bbut\b/i.test(t) && /\bsorry\b/i.test(t)) add("warn", "“Sorry, but…”", "Anything after “but” cancels the apology. End the apology with a period.");
    if (DRY.test(t)) add("warn", "Very short / dry reply", "One-word replies can feel cold. Add one warm sentence or an emoji.");

    if (/\bi feel\b/i.test(t)) add("good", "Nice — you used an I-statement", "This keeps it about your experience instead of blame.");
    if (/\b(thank you|thanks|appreciate)\b/i.test(t)) add("good", "Appreciation spotted", "Gratitude lowers defenses. Keep it.");
    if (/\b(love you|❤️|🫶|💛|miss you)\b/i.test(t)) add("good", "Affection included", "Reminding her you're on the same team helps everything land better.");
    if (/\?\s*$/.test(t) && !/\bwhy didn'?t you\b/i.test(t)) add("good", "Ends with a question", "Inviting her to respond keeps the conversation two-way.");

    if (!flags.some(f => f.level === "warn") && t.length > 3) add("good", "Looks kind and clear", "Nothing here is likely to be misread. Send it!");
    return flags;
  }

  window.Tone = { TONES, rewrite, analyze };
})();
