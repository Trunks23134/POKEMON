import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import POKEMON_POOL, { Pokemon, Tier, ORIGINAL_RARE_IDS } from "./data/pokemon_pool";
type Phase = "IDLE" | "GRASS" | "FLASH" | "SILHOUETTE" | "THROW_READY" | "THROWING" | "SHAKING" | "CATCH" | "REVEAL" | "RESULT";
type HistoryEntry = { pokemon: Pokemon; tier: Tier };

const STORAGE_KEY = "crossroads_rare_pool";

const TYPE_COLORS: Record<string, string> = {
  Normal: "#A8A878",
  Fire: "#F08030",
  Water: "#6890F0",
  Electric: "#F8D030",
  Grass: "#78C850",
  Ice: "#98D8D8",
  Fighting: "#C03028",
  Poison: "#A040A0",
  Ground: "#E0C068",
  Flying: "#A890F0",
  Psychic: "#F85888",
  Bug: "#A8B820",
  Rock: "#B8A038",
  Ghost: "#705898",
  Dragon: "#7038F8",
  Dark: "#705848",
  Steel: "#B8B8D0",
  Fairy: "#EE99AC",
};

const BASE = (import.meta as any).env?.BASE_URL ?? './';
const DEFAULT_REMOTE_SPRITE_BASE = 'https://raw.githubusercontent.com/sashafirsov/pokeapi-sprites/master/';

const buildRemoteSpriteBase = (repoUrl?: string) => {
  if (!repoUrl) return DEFAULT_REMOTE_SPRITE_BASE;
  const ghMatch = repoUrl.match(/github\.com\/(.+?)\/(.+?)(?:\.git)?(?:$|\/)/i);
  if (!ghMatch) return DEFAULT_REMOTE_SPRITE_BASE;
  const owner = ghMatch[1];
  const repo = ghMatch[2];
  return `https://raw.githubusercontent.com/${owner}/${repo}/master/`;
};

const REMOTE_SPRITE_BASE = buildRemoteSpriteBase((import.meta as any).env?.VITE_POKEMON_POOL_URL);
const localGifCandidates = (id: number) => [
  `${BASE}sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`,
];
const localPngCandidates = (id: number) => [
  `${BASE}sprites/pokemon/other/official-artwork/${id}.png`,
  `${BASE}sprites/pokemon/${id}.png`,
];
const remoteGifCandidates = (id: number, name?: string) => [
  `${REMOTE_SPRITE_BASE}sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`,
  `https://play.pokemonshowdown.com/sprites/ani/${(name||'').toLowerCase().replace(/[^a-z0-9-]/g,'')}.gif`,
];
const remotePngCandidates = (id: number) => [
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
];
const cryUrl = (name: string) => `https://play.pokemonshowdown.com/audio/cries/${name.toLowerCase().replace(/[^a-z0-9-]/g,'')}.mp3`;

function spriteUrl(id: number) {
  return localGifCandidates(id)[0];
}

function remoteSpriteUrl(id: number, name?: string) {
  return remoteGifCandidates(id, name)[0];
}

function allSpriteCandidates(id: number, name?: string) {
  return [
    ...localGifCandidates(id),
    ...remoteGifCandidates(id, name),
    ...localPngCandidates(id),
    ...remotePngCandidates(id),
  ];
}

function pokemonSprite(pokemon: Pokemon) {
  return pokemon.sprite ?? spriteUrl(pokemon.id);
}

// `loadRarePool` and `saveRarePool` are created inside the component to reference
// the runtime `pokemonPool` state (which may be fetched from remote).

function spinOutcome(rarePoolEmpty: boolean): Tier {
  const roll = Math.random() * 100;
  if (!rarePoolEmpty && roll < 5) return "RARE";
  if (roll < 30) return "UNCOMMON";
  return "COMMON";
}



function TypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        background: TYPE_COLORS[type] ?? "#888",
        color: "white",
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        display: "inline-block",
      }}
    >
      {type}
    </span>
  );
}

function Pokeball({ size = 80, shaking = false, shakeIntensity = 1 }: { size?: number; shaking?: boolean; shakeIntensity?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        animation: shaking ? `pokeShake ${0.15 * shakeIntensity}s ease-in-out infinite alternate` : "none",
        filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.7))",
      }}
    >
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <linearGradient id="pokeball-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d4d" />
            <stop offset="100%" stopColor="#c31a1a" />
          </linearGradient>
          <radialGradient id="pokeball-white-glow" cx="50%" cy="40%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="54" fill="#fff" stroke="#111" strokeWidth="8" />
        <path d="M6,60 A54,54 0 0,1 114,60 L6,60 Z" fill="url(#pokeball-red)" />
        <path d="M6,60 H114" stroke="#111" strokeWidth="14" strokeLinecap="round" />
        <circle cx="60" cy="60" r="22" fill="#fff" stroke="#111" strokeWidth="10" />
        <circle cx="60" cy="60" r="10" fill="#f4f4f4" stroke="#111" strokeWidth="4" />
        <circle cx="60" cy="60" r="4" fill="#111" />
        <ellipse cx="42" cy="38" rx="14" ry="6" fill="rgba(255,255,255,0.7)" />
        <ellipse cx="68" cy="30" rx="8" ry="4" fill="rgba(255,255,255,0.45)" />
        <ellipse cx="60" cy="88" rx="36" ry="10" fill="rgba(0,0,0,0.18)" />
      </svg>
    </div>
  );
}

function GrassBlade({ x, height, delay, animating }: { x: number; height: string; delay: number; animating: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: `${x}%`,
        width: 18,
        transformOrigin: "bottom center",
        animation: animating ? `grassRustle ${0.3 + Math.random() * 0.2}s ease-in-out infinite alternate` : `grassSway ${1.5 + Math.random()}s ease-in-out infinite alternate`,
        animationDelay: `${delay}s`,
      }}
    >
      <svg viewBox="0 0 18 60" style={{ height, display: "block" }}>
        <path d={`M9 60 C${5 + Math.random() * 4} ${40 + Math.random() * 5}, ${2 + Math.random() * 4} ${20 + Math.random() * 5}, ${8 + Math.random() * 4} 0`} stroke="#5DBB5D" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function useAudio() {
  const audioCtx = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!audioCtx.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx.current = new Ctor();
    }
    return audioCtx.current;
  }, []);

  const battleAudioRef = useRef<HTMLAudioElement | null>(null);
  const wobbleAudioRef = useRef<HTMLAudioElement | null>(null);

  const tone = useCallback(
    (freq: number, duration: number, type: OscillatorType = "sine", vol = 0.3) => {
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch {
        // ignore
      }
    },
    [getCtx]
  );

  const playGrassRustle = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    for (let i = 0; i < 6; i += 1) {
      window.setTimeout(() => {
        const len = Math.floor(ctx.sampleRate * 0.12);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < len; j += 1) data[j] = (Math.random() * 2 - 1) * 0.4;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 800 + Math.random() * 400;
        filter.Q.value = 0.5;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start();
      }, i * 150);
    }
  }, [getCtx]);

  return useMemo(
    () => ({
      playGrassRustle,
      playFlash: () => {
        tone(880, 0.08, "square", 0.2);
        window.setTimeout(() => tone(1100, 0.08, "square", 0.2), 100);
        window.setTimeout(() => tone(1320, 0.08, "square", 0.25), 200);
      },
      playThrow: () => {
        const ctx = getCtx();
        if (!ctx) return;
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(300, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        } catch {
          // ignore
        }
      },
      playShake: () => {
        const ctx = getCtx();
        if (!ctx) return;
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(120, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } catch {
          // ignore
        }
        try {
          if (!wobbleAudioRef.current) {
            wobbleAudioRef.current = new Audio(encodeURI(`${BASE}audio/pokeball-wobble-sound-effect-(pokemon-go)-made-with-Voicemod.mp3`));
            wobbleAudioRef.current.volume = 0.7;
          } else {
            wobbleAudioRef.current.currentTime = 0;
          }
          void wobbleAudioRef.current.play().catch(() => {});
        } catch {
          // ignore
        }
      },
      playCatch: () => {
        const ctx = getCtx();
        if (!ctx) return;
        const now = ctx.currentTime;

        const clickBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
        const clickData = clickBuffer.getChannelData(0);
        for (let i = 0; i < clickData.length; i += 1) {
          clickData[i] = (Math.random() * 2 - 1) * (1 - i / clickData.length) * 0.35;
        }
        const click = ctx.createBufferSource();
        click.buffer = clickBuffer;
        const clickFilter = ctx.createBiquadFilter();
        clickFilter.type = "highpass";
        clickFilter.frequency.value = 700;
        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.5, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        click.connect(clickFilter).connect(clickGain).connect(ctx.destination);
        click.start(now);
        click.stop(now + 0.08);

        const sweep = ctx.createOscillator();
        const sweepGain = ctx.createGain();
        sweep.type = "triangle";
        sweep.frequency.setValueAtTime(220, now);
        sweep.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        sweepGain.gain.setValueAtTime(0.001, now);
        sweepGain.gain.linearRampToValueAtTime(0.35, now + 0.05);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        sweep.connect(sweepGain).connect(ctx.destination);
        sweep.start(now);
        sweep.stop(now + 0.25);

        const thump = ctx.createOscillator();
        const thumpGain = ctx.createGain();
        thump.type = "sine";
        thump.frequency.setValueAtTime(80, now);
        thumpGain.gain.setValueAtTime(0.2, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        thump.connect(thumpGain).connect(ctx.destination);
        thump.start(now);
        thump.stop(now + 0.2);
      },
      playFlee: () => {
        tone(180, 0.16, "square", 0.2);
        window.setTimeout(() => tone(240, 0.14, "triangle", 0.15), 120);
      },
      playBattleLoop: () => {
        if (!battleAudioRef.current) {
          battleAudioRef.current = new Audio(encodeURI(`${BASE}audio/pokemon battle - QuickSounds.com.mp3`));
          battleAudioRef.current.loop = true;
          battleAudioRef.current.volume = 0.22;
        }
        try {
          battleAudioRef.current.currentTime = 0;
          void battleAudioRef.current.play();
        } catch {
          // ignore
        }
      },
      stopBattle: () => {
        if (!battleAudioRef.current) return;
        battleAudioRef.current.pause();
        battleAudioRef.current.currentTime = 0;
      },
      playCaught: () => {
        try {
          const a = new Audio(encodeURI(`${BASE}audio/06-caught-a-pokemon.mp3`));
          a.volume = 0.9;
          void a.play();
        } catch {
          // ignore
        }
      },
      playRareStinger: () => {
        [196, 247, 294, 392, 494, 587, 784].forEach((freq, index) => {
          window.setTimeout(() => tone(freq, 0.2, "triangle", 0.35), index * 60);
        });
        window.setTimeout(() => tone(1047, 0.4, "sine", 0.5), 500);
      },
    }),
    [getCtx, playGrassRustle, tone]
  );
}

function ballShakeKeyframes() {
  return `@keyframes pokeShake { from { transform: rotate(-12deg); } to { transform: rotate(12deg); } }`;
}

export default function CatchingStation() {
  const pokemonPool = POKEMON_POOL;

  function loadRarePool(): Pokemon[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [...pokemonPool.RARE];
      const ids = JSON.parse(raw) as number[];
      return pokemonPool.RARE.filter((pokemon) => ids.includes(pokemon.id));
    } catch {
      return [...pokemonPool.RARE];
    }
  }

  function saveRarePool(pool: Pokemon[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pool.map((pokemon) => pokemon.id)));
    } catch {
      // ignore
    }
  }
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [rarePool, setRarePool] = useState<Pokemon[]>(() => loadRarePool());
  const cryCacheRef = useRef<Record<number, HTMLAudioElement>>({});

  const grassBlades = useMemo(() => {
    return {
      front: Array.from({ length: 40 }).map((_, i) => ({
        key: i,
        x: (i / 40) * 100 + Math.random() * 2.5 - 1.25,
        height: `${60 + Math.random() * 80}px`,
        delay: Math.random() * 0.8,
      })),
      back: Array.from({ length: 30 }).map((_, i) => ({
        key: `b${i}`,
        x: (i / 30) * 100 + 1.5,
        height: `${40 + Math.random() * 60}px`,
        delay: 0.1 + Math.random() * 0.6,
      })),
    };
  }, [phase]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fullRare = [...POKEMON_POOL.RARE];
        setRarePool(fullRare);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullRare.map((p) => p.id)));
      }
    } catch {
      // ignore
    }
  }, []);

  const [grassAnimating, setGrassAnimating] = useState(false);
  const [currentShake, setCurrentShake] = useState(0);
  const [revealStep, setRevealStep] = useState(0);
  const [rareFlash, setRareFlash] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [catchStars, setCatchStars] = useState(false);
  const [didFlee, setDidFlee] = useState(false);
  const [throwMeter, setThrowMeter] = useState(50);
  const throwMeterDir = useRef(1);
  const [throwAccuracy, setThrowAccuracy] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showDisplayOnly, setShowDisplayOnly] = useState(false);
  const audio = useAudio();
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const allPokemon = [...POKEMON_POOL.COMMON, ...POKEMON_POOL.UNCOMMON, ...POKEMON_POOL.RARE];
    allPokemon.forEach((pokemonItem) => {
      if (!cryCacheRef.current[pokemonItem.id]) {
        const audioEl = new Audio(pokemonItem.cry);
        audioEl.preload = "auto";
        cryCacheRef.current[pokemonItem.id] = audioEl;
      }
    });
  }, []);

  const playCry = useCallback((pokemon: Pokemon | null, rare = false) => {
    if (!pokemon) return;
    const cached = cryCacheRef.current[pokemon.id];
    try {
      if (cached) {
        cached.volume = rare ? 1 : 0.7;
        cached.currentTime = 0;
        void cached.play().catch(() => {});
      } else {
        const audioEl = new Audio(pokemon.cry);
        audioEl.volume = rare ? 1 : 0.7;
        void audioEl.play().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);
  function selectPokemonLocal(tierParam: Tier, rarePoolParam: Pokemon[]) {
    const pool = tierParam === "RARE" ? rarePoolParam : pokemonPool[tierParam];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const doSpin = useCallback(() => {
    if (phaseRef.current !== "IDLE" && phaseRef.current !== "RESULT") return;

    const outcome = spinOutcome(rarePool.length === 0);
    let nextPokemon: Pokemon;
    let nextRarePool = rarePool;

    if (outcome === "RARE" && rarePool.length > 0) {
      nextPokemon = selectPokemonLocal("RARE", rarePool);
      nextRarePool = rarePool.filter((p) => p.id !== nextPokemon.id);
      setRarePool(nextRarePool);
      saveRarePool(nextRarePool);
      setTier("RARE");
    } else if (outcome === "UNCOMMON") {
      nextPokemon = selectPokemonLocal("UNCOMMON", rarePool);
      setTier("UNCOMMON");
    } else {
      nextPokemon = selectPokemonLocal("COMMON", rarePool);
      setTier("COMMON");
    }

    setPokemon(nextPokemon);
    setRevealStep(0);
    setCurrentShake(0);
    setCatchStars(false);
    setRareFlash(false);
    setDidFlee(false);
    setGrassAnimating(false);
    setPhase("GRASS");
    audio.playBattleLoop();
  }, [rarePool, pokemonPool, audio]);

  const doThrow = useCallback(() => {
    if (phaseRef.current !== "THROW_READY") return;
    const accuracy = 100 - Math.abs(throwMeter - 50) * 2;
    setThrowAccuracy(Math.max(0, Math.min(accuracy, 100)));
    setPhase("THROWING");
    audio.playThrow();
  }, [audio, throwMeter]);

  const doNext = useCallback(() => {
    if (phaseRef.current !== "RESULT") return;
    setPhase("IDLE");
    setPokemon(null);
    setTier(null);
    setRevealStep(0);
    setCurrentShake(0);
    setRareFlash(false);
    setCatchStars(false);
    setDidFlee(false);
    setGrassAnimating(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        // Reset to the original canonical rare IDs (guarantees full original set)
        const full = POKEMON_POOL.RARE.filter((p) => ORIGINAL_RARE_IDS.includes(p.id));
        setRarePool(full);
        saveRarePool(full);
        setShowAdmin(true);
        window.setTimeout(() => setShowAdmin(false), 2000);
        return;
      }
      if (e.key.toLowerCase() === "f") {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen().catch(() => {});
        } else {
          void document.exitFullscreen().catch(() => {});
        }
        return;
      }
      if (e.code === "Space" || e.key === "Enter" || e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (phaseRef.current === "IDLE") doSpin();
        else if (phaseRef.current === "THROW_READY") doThrow();
        else if (phaseRef.current === "RESULT") doNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doSpin, doThrow, doNext]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (phase === "GRASS") {
      audio.playGrassRustle();
      const t1 = window.setTimeout(() => setGrassAnimating(true), 800);
      const t2 = window.setTimeout(() => {
        audio.playFlash();
        setPhase("FLASH");
      }, 2400);
      cleanup = () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (phase === "FLASH") {
      const t = window.setTimeout(() => {
        setPhase("SILHOUETTE");
      }, 500);
      cleanup = () => window.clearTimeout(t);
    } else if (phase === "SILHOUETTE") {
      const hold = tier === "RARE" ? 5000 : 2000;
      const t = window.setTimeout(() => setPhase("THROW_READY"), hold);
      cleanup = () => window.clearTimeout(t);
    } else if (phase === "THROW_READY") {
      setThrowMeter(0);
      throwMeterDir.current = 1;
      const meter = window.setInterval(() => {
        setThrowMeter((current) => {
          let next = current + 2 * throwMeterDir.current;
          if (next >= 100) {
            next = 100;
            throwMeterDir.current = -1;
          } else if (next <= 0) {
            next = 0;
            throwMeterDir.current = 1;
          }
          return next;
        });
      }, 16);
      cleanup = () => window.clearInterval(meter);
    } else if (phase === "THROWING") {
      const t = window.setTimeout(() => setPhase("SHAKING"), 850);
      cleanup = () => window.clearTimeout(t);
    } else if (phase === "SHAKING") {
      const base = tier === "RARE" ? 5 : 3;
      const bonus = throwAccuracy !== null ? Math.floor(Math.max(0, throwAccuracy - 40) / 30) : 0;
      const total = Math.max(base - bonus, tier === "RARE" ? 4 : 2);
      const interval = tier === "RARE" ? 1200 : 800;
      let shakes = 0;
      const doShake = () => {
        if (shakes >= total) {
          window.setTimeout(() => {
            setCatchStars(true);
            audio.playCatch();
            setPhase("CATCH");
          }, 300);
          return;
        }
        shakes += 1;
        setCurrentShake(shakes);
        audio.playShake();
        window.setTimeout(doShake, interval);
      };
      const t = window.setTimeout(doShake, 300);
      cleanup = () => window.clearTimeout(t);
    } else if (phase === "CATCH") {
      const t = window.setTimeout(() => {
        setCatchStars(false);
        const accuracy = throwAccuracy ?? 0;
        const fleeChance = accuracy >= 45 ? 0 : Math.min(0.7, (45 - accuracy) / 60);
        const didEscape = accuracy < 45 && Math.random() < fleeChance;
        setDidFlee(didEscape);

        if (didEscape) {
          audio.playFlee();
          setPhase("RESULT");
          return;
        }

        if (tier === "RARE") {
          setRareFlash(true);
          audio.playRareStinger();
          window.setTimeout(() => {
            setRareFlash(false);
            audio.playCaught();
            setPhase("REVEAL");
          }, 400);
        } else {
          audio.playCaught();
          setPhase("REVEAL");
        }
      }, 500);
      cleanup = () => window.clearTimeout(t);
    } else if (phase === "REVEAL") {
      playCry(pokemon, tier === "RARE");
      [1, 2, 3, 4].forEach((step, index) => {
        window.setTimeout(() => setRevealStep(step), index * 350 + 400);
      });
      const t = window.setTimeout(() => {
        setPhase("RESULT");
        if (pokemon && tier) {
          setHistory((current) => [{ pokemon, tier }, ...current].slice(0, 5));
        }
      }, 4 * 350 + 1200);
      cleanup = () => window.clearTimeout(t);
    }

    return cleanup;
  }, [phase, tier, pokemon, audio]);

  useEffect(() => {
    if (phase === "IDLE" || phase === "REVEAL" || phase === "RESULT") {
      audio.stopBattle();
    }
  }, [phase, audio]);

  const tierLabel = tier === "RARE" ? "RARE" : tier === "UNCOMMON" ? "UNCOMMON" : "COMMON";
  const tierColor = tier === "RARE" ? "#FFD700" : tier === "UNCOMMON" ? "#C0C0C0" : "#CD7F32";
  const phaseTitle = phase === "IDLE" ? "READY" : phase === "GRASS" ? "TALL GRASS" : phase === "FLASH" ? "ENCOUNTER!" : phase === "SILHOUETTE" ? "SILHOUETTE" : phase === "THROW_READY" ? "THROW" : phase === "THROWING" ? "STRIKE" : phase === "SHAKING" ? "SHAKING" : phase === "CATCH" ? "CAPTURE" : phase === "REVEAL" ? "REVEAL" : didFlee ? "ESCAPE" : "RESULT";
  const phasePrompt = phase === "IDLE"
    ? "Search the crossroads for a wild encounter."
    : phase === "GRASS"
    ? "The grass is rustling... stay alert."
    : phase === "FLASH"
    ? "A sudden burst of light! Something's coming."
    : phase === "SILHOUETTE"
    ? "Guess the Pokémon from its silhouette."
    : phase === "THROW_READY"
    ? "Time your throw. Press SPACE or CLICK THROW when the marker hits the strike zone."
    : phase === "THROWING"
    ? "The Pokéball is flying through the air..."
    : phase === "SHAKING"
    ? `The ball is shaking — ${tier === "RARE" ? "5" : "3"} times total.`
    : phase === "CATCH"
    ? "Close... almost there!"
    : phase === "REVEAL"
    ? "It's time to see who appeared!"
    : didFlee
    ? "The Pokémon broke free and fled from the ball!"
    : "Review the result and continue when ready.";

  return (
    <div style={{ width: "100%", height: "100vh", background: "#0A0A1A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", fontFamily: "'Georgia', serif", userSelect: "none" }}>
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 180, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", color: "rgba(255,255,255,0.9)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, letterSpacing: 2 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", minWidth: 0, maxWidth: "calc(100% - 160px)" }}>
          <div style={{ border: "1px solid rgba(255,255,255,0.15)", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.04)", textTransform: "uppercase" }}>THE CROSSROADS</div>
          <div style={{ border: "1px solid rgba(255,255,255,0.15)", padding: "8px 12px", borderRadius: 999, background: "rgba(0,255,170,0.08)", color: "#00FFAA" }}>PHASE: {phaseTitle}</div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, zIndex: 150, display: "flex", justifyContent: "center", alignItems: "center", color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", fontSize: 13, letterSpacing: 1.2, textAlign: "center", padding: "10px 16px", borderRadius: 999, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {phasePrompt}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@400;600;700&display=swap');
        ${ballShakeKeyframes()}
        @keyframes grassSway { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
        @keyframes grassRustle { from { transform: rotate(-18deg) translateX(-4px); } to { transform: rotate(18deg) translateX(4px); } }
        @keyframes encounterFlash { 0%, 12.5% { background: white; } 20%, 32.5% { background: #0A0A1A; } 40%, 52.5% { background: white; } 60%, 72.5% { background: #0A0A1A; } 80%, 92.5% { background: white; } 100% { background: #0A0A1A; } }
        @keyframes ballArc { 0% { transform: translate(0, 0) rotate(0deg); } 30% { transform: translate(180px, -220px) rotate(180deg); } 70% { transform: translate(340px, -140px) rotate(360deg); } 100% { transform: translate(360px, 60px) rotate(480deg); } }
        @keyframes spriteReveal { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        @keyframes rareSpriteReveal { 0% { opacity: 0; transform: scale(0); } 60% { opacity: 1; transform: scale(1.3); } 80% { transform: scale(0.95); } 100% { opacity: 1; transform: scale(1.2); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0%, 100% { text-shadow: 0 0 20px rgba(0,255,170,0.4); } 50% { text-shadow: 0 0 40px rgba(0,255,170,0.9), 0 0 80px rgba(0,255,170,0.3); } }
        @keyframes idleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes catchStar { 0% { transform: scale(0) rotate(0deg); opacity: 1; } 100% { transform: scale(2.5) rotate(180deg); opacity: 0; } }
        @keyframes rareGlow { 0%, 100% { box-shadow: 0 0 30px rgba(255,215,0,0.3); } 50% { box-shadow: 0 0 80px rgba(255,215,0,0.9), 0 0 120px rgba(255,215,0,0.4); } }
      `}</style>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 100, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)" }} />

      {showAdmin && <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", background: "#00FF88", color: "#000", padding: "10px 24px", borderRadius: 8, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 14, zIndex: 200 }}>✓ RARE POOL RESET</div>}

      {!showDisplayOnly && (
        <div style={{ position: "absolute", top: 16, right: 16, zIndex: 150, display: "flex", gap: 10, alignItems: "center" }}>
          {phase === "IDLE" && <div style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)", color: "#FFD700", padding: "5px 12px", borderRadius: 20, fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700 }}>⭐ RARE: {rarePool.length}/{ORIGINAL_RARE_IDS.length}</div>}
          <div
            onClick={() => {
              if (!document.fullscreenElement) {
                void document.documentElement.requestFullscreen().catch(() => {});
              } else {
                void document.exitFullscreen().catch(() => {});
              }
            }}
            style={{ cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 18, padding: "4px 8px" }}
            title="Toggle fullscreen (F)"
          >
            ⛶
          </div>
        </div>
      )}

      {phase === "IDLE" && !showDisplayOnly && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, color: "#00FFAA", letterSpacing: 8, textTransform: "uppercase", opacity: 0.7 }}>CATCHING STATION</div>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(32px, 6vw, 72px)", fontWeight: 900, color: "white", letterSpacing: 6, animation: "pulseGlow 3s ease-in-out infinite" }}>THE CROSSROADS</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.35)", letterSpacing: 4 }}>TRIAL OF THREE SHORES</div>
          <div style={{ width: 120, height: 2, background: "linear-gradient(90deg, transparent, #00FFAA, transparent)", margin: "8px 0" }} />
          <div style={{ animation: "idleFloat 3s ease-in-out infinite", marginTop: 8 }}>
            <Pokeball size={90} />
          </div>
          <button onClick={doSpin} style={{ marginTop: 20, background: "linear-gradient(135deg, #00FFAA, #00CC88)", border: "none", borderRadius: 50, color: "#000", fontFamily: "'Orbitron', sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: 3, padding: "18px 60px", cursor: "pointer", boxShadow: "0 0 40px rgba(0,255,170,0.4)" }}>SEARCH</button>
          <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 2 }}>PRESS SPACE OR CLICK TO BEGIN</div>
          {history.length > 0 && (
            <div style={{ position: "absolute", bottom: 20, left: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 4 }}>RECENT</div>
              {history.map((entry, index) => (
                <div key={`${entry.pokemon.id}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8, color: entry.tier === "RARE" ? "#FFD700" : entry.tier === "UNCOMMON" ? "#C0C0C0" : "#aaa", fontSize: 12, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, opacity: 1 - index * 0.15 }}>
                  <img
                src={pokemonSprite(entry.pokemon)}
                data-pokemon-id={entry.pokemon.id}
                data-pokemon-name={entry.pokemon.name}
                alt=""
                width={24}
                height={24}
                onError={(event) => {
                  const target = event.currentTarget as any;
                  const id = Number(target.dataset.pokemonId ?? (target.getAttribute && target.getAttribute('data-pokemon-id')));
                  const name = target.dataset.pokemonName ?? (target.getAttribute && target.getAttribute('data-pokemon-name')) ?? '';
                  const attempt = Number(target.dataset.attempt || '0');
                  const fallbacks = allSpriteCandidates(id, name);
                  if (attempt < fallbacks.length - 1) {
                    target.dataset.attempt = String(attempt + 1);
                    target.src = fallbacks[attempt + 1];
                  }
                }}
                style={{ imageRendering: "pixelated", opacity: 0.7 }}
              />
                  {entry.pokemon.name}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{entry.tier}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === "GRASS" && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #0A1A0A 0%, #0D2A0D 60%, #0A1A0A 100%)", overflow: "hidden" }}>
          {grassBlades.front.map((blade) => <GrassBlade key={blade.key} x={blade.x} height={blade.height} delay={blade.delay} animating={grassAnimating} />)}
          {grassBlades.back.map((blade) => <GrassBlade key={blade.key} x={blade.x} height={blade.height} delay={blade.delay} animating={grassAnimating} />)}
        </div>
      )}

      {phase === "FLASH" && <div style={{ position: "absolute", inset: 0, animation: "encounterFlash 0.5s ease-out forwards" }} />}

      {phase === "SILHOUETTE" && pokemon && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
          {tier === "RARE" && <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, color: "#FFD700", letterSpacing: 6, animation: "pulseGlow 1s ease-in-out infinite", opacity: 0.9 }}>SOMETHING UNUSUAL STIRS...</div>}
          <img
            src={pokemonSprite(pokemon)}
            data-pokemon-id={pokemon.id}
            data-pokemon-name={pokemon.name}
            alt="???"
            onError={(event) => {
              const target = event.currentTarget as any;
              const id = Number(target.dataset.pokemonId ?? (target.getAttribute && target.getAttribute('data-pokemon-id')));
              const name = target.dataset.pokemonName ?? (target.getAttribute && target.getAttribute('data-pokemon-name')) ?? '';
              const attempt = Number(target.dataset.attempt || '0');
              const fallbacks = allSpriteCandidates(id, name);
              if (attempt < fallbacks.length - 1) {
                target.dataset.attempt = String(attempt + 1);
                target.src = fallbacks[attempt + 1];
              }
            }}
            style={{ width: tier === "RARE" ? 200 : 160, height: tier === "RARE" ? 200 : 160, imageRendering: "pixelated", filter: "brightness(0)", animation: "idleFloat 2s ease-in-out infinite" }}
          />
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(14px, 2vw, 20px)", color: "white", letterSpacing: 2 }}>A wild Pokemon appeared!</div>
        </div>
      )}

      {phase === "THROW_READY" && pokemon && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, textAlign: "center", width: "100%", maxWidth: 420, padding: "0 16px" }}>
          <img
            src={pokemonSprite(pokemon)}
            data-pokemon-id={pokemon.id}
            data-pokemon-name={pokemon.name}
            alt="???"
            onError={(event) => {
              const target = event.currentTarget as any;
              const id = Number(target.dataset.pokemonId ?? (target.getAttribute && target.getAttribute('data-pokemon-id')));
              const name = target.dataset.pokemonName ?? (target.getAttribute && target.getAttribute('data-pokemon-name')) ?? '';
              const attempt = Number(target.dataset.attempt || '0');
              const fallbacks = allSpriteCandidates(id, name);
              if (attempt < fallbacks.length - 1) {
                target.dataset.attempt = String(attempt + 1);
                target.src = fallbacks[attempt + 1];
              }
            }}
            style={{ width: tier === "RARE" ? 200 : 160, height: tier === "RARE" ? 200 : 160, imageRendering: "pixelated", filter: "brightness(0)", animation: "idleFloat 2s ease-in-out infinite" }}
          />
          <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <div style={{ width: "100%", height: 18, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: "40%", width: "20%", height: "100%", background: "rgba(0,255,170,0.2)" }} />
              <div style={{ position: "absolute", left: `${throwMeter}%`, width: 8, height: 28, top: -5, background: "#00FFAA", borderRadius: 4, transform: "translateX(-50%)", transition: "left 0.08s linear" }} />
            </div>
            <div style={{ color: throwMeter >= 40 && throwMeter <= 60 ? "#00FFAA" : "#FFD700", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" }}>
              {throwMeter >= 40 && throwMeter <= 60 ? "Perfect Throw" : throwMeter >= 30 && throwMeter <= 70 ? "Good Timing" : "Off Target"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Pokeball size={60} />
              <button onClick={doThrow} style={{ background: "linear-gradient(135deg, #EE3333, #CC1111)", border: "none", borderRadius: 50, color: "white", fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 3, padding: "16px 42px", cursor: "pointer", boxShadow: "0 0 30px rgba(238,51,51,0.5)" }}>THROW!</button>
            </div>
          </div>
        </div>
      )}

      {phase === "THROWING" && pokemon && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", left: "10%", bottom: "20%", animation: "ballArc 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards" }}>
            <Pokeball size={60} />
          </div>
        </div>
      )}

      {(phase === "SHAKING" || phase === "CATCH") && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
          <div style={{ position: "relative" }}>
            <Pokeball size={100} shaking={phase === "SHAKING" && currentShake > 0} shakeIntensity={tier === "RARE" ? 1.5 : 1} />
            {catchStars && [0, 60, 120, 180, 240, 300].map((deg) => <div key={deg} style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-60px)`, color: "#FFD700", fontSize: 20, animation: "catchStar 0.6s ease-out forwards" }}>★</div>)}
          </div>
              {/* shake counter removed to keep capture outcome hidden */}
          {tier === "RARE" && <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, color: "#FFD700", letterSpacing: 4, animation: "pulseGlow 0.8s infinite" }}>HANG ON...</div>}
        </div>
      )}

      {rareFlash && <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(255,215,0,0.82)", animation: "spriteReveal 0.4s ease-out forwards", pointerEvents: "none" }} />}

      {(phase === "REVEAL" || phase === "RESULT") && pokemon && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center", padding: 20, animation: tier === "RARE" ? "rareGlow 2s ease-in-out infinite" : "none", borderRadius: 20 }}>
          <img
            src={pokemonSprite(pokemon)}
            data-pokemon-id={pokemon.id}
            data-pokemon-name={pokemon.name}
            alt={pokemon.name}
            onError={(event) => {
              const target = event.currentTarget as any;
              const id = Number(target.dataset.pokemonId ?? (target.getAttribute && target.getAttribute('data-pokemon-id')));
              const name = target.dataset.pokemonName ?? (target.getAttribute && target.getAttribute('data-pokemon-name')) ?? '';
              const attempt = Number(target.dataset.attempt || '0');
              const fallbacks = allSpriteCandidates(id, name);
              if (attempt < fallbacks.length - 1) {
                target.dataset.attempt = String(attempt + 1);
                target.src = fallbacks[attempt + 1];
              }
            }}
            style={{ width: tier === "RARE" ? 200 : 160, height: tier === "RARE" ? 200 : 160, imageRendering: "pixelated", animation: tier === "RARE" ? "rareSpriteReveal 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards" : "spriteReveal 0.5s ease-out forwards", filter: tier === "RARE" ? "drop-shadow(0 0 20px rgba(255,215,0,0.8))" : "none" }}
          />
          {didFlee && phase === "RESULT" && (
            <div style={{ animation: "fadeUp 0.4s ease-out forwards", color: "#FF8888", fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: 800, maxWidth: 400, lineHeight: 1.4 }}>
              The Pokémon broke free from the Pokéball and fled into the tall grass!
            </div>
          )}
          {revealStep >= 1 && <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(22px, 4vw, 44px)", fontWeight: 900, color: tier === "RARE" ? "#FFD700" : "white", letterSpacing: 4, animation: "fadeUp 0.4s ease-out forwards", textShadow: tier === "RARE" ? "0 0 30px rgba(255,215,0,0.6)" : "none" }}>{pokemon.name.toUpperCase()}</div>}
          {revealStep >= 2 && <div style={{ animation: "fadeUp 0.4s ease-out forwards", display: "flex", gap: 8 }}><TypeBadge type={pokemon.type1} />{pokemon.type2 && <TypeBadge type={pokemon.type2} />}</div>}
          {revealStep >= 3 && <div style={{ animation: "fadeUp 0.4s ease-out forwards", background: tier === "RARE" ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.07)", border: `2px solid ${tierColor}`, color: tierColor, padding: "6px 24px", borderRadius: 30, fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 3 }}>{tierLabel}</div>}
          {revealStep >= 4 && <div style={{ animation: "fadeUp 0.4s ease-out forwards", color: "rgba(255,255,255,0.45)", fontFamily: "'Rajdhani', sans-serif", fontSize: 14, letterSpacing: 3, textTransform: "uppercase" }}>{pokemon.region} Native</div>}
          {phase === "RESULT" && <button onClick={doNext} style={{ marginTop: 12, background: "transparent", border: "2px solid rgba(255,255,255,0.3)", borderRadius: 50, color: "rgba(255,255,255,0.6)", fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 3, padding: "12px 40px", cursor: "pointer" }}>NEXT HERO →</button>}
          {phase === "RESULT" && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 2 }}>PRESS SPACE OR N FOR NEXT SPIN</div>}
        </div>
      )}

      {showControls ? (
        <div style={{ position: "absolute", bottom: 70, right: 18, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "flex-end", zIndex: 180, maxWidth: "calc(100% - 36px)" }}>
          <button onClick={() => setShowDisplayOnly((v) => !v)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, minWidth: 88 }}> {showDisplayOnly ? "SHOW UI" : "HIDE UI"}</button>
          <button onClick={() => setShowControls(false)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, minWidth: 88 }}>CLOSE</button>
        </div>
      ) : (
        <div style={{ position: "absolute", bottom: 70, right: 18, zIndex: 180 }}>
          <button onClick={() => { setShowControls(true); setShowDisplayOnly(false); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "white", padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>OPEN</button>
        </div>
      )}
    </div>
  );
}
