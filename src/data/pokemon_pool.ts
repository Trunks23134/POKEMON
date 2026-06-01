export type Region = "Johto" | "Kalos" | "Alola" | "Unknown";

export type Pokemon = {
  id: number;
  name: string;
  type1: string;
  type2: string | null;
  region: Region;
};

export type Tier = "COMMON" | "UNCOMMON" | "RARE";

export const ORIGINAL_RARE_IDS = [248, 245, 784, 718, 785] as const;

export const POKEMON_POOL: Record<Tier, Pokemon[]> = {
  COMMON: [
    { id: 16, name: "Pidgey", type1: "Normal", type2: "Flying", region: "Johto" },
    { id: 19, name: "Rattata", type1: "Normal", type2: null, region: "Johto" },
    { id: 161, name: "Sentret", type1: "Normal", type2: null, region: "Johto" },
    { id: 163, name: "Hoothoot", type1: "Normal", type2: "Flying", region: "Johto" },
    { id: 41, name: "Zubat", type1: "Poison", type2: "Flying", region: "Johto" },
    { id: 187, name: "Hoppip", type1: "Grass", type2: "Flying", region: "Johto" },
    { id: 206, name: "Dunsparce", type1: "Normal", type2: null, region: "Johto" },
    { id: 213, name: "Shuckle", type1: "Bug", type2: "Rock", region: "Johto" },
    { id: 661, name: "Fletchling", type1: "Normal", type2: "Flying", region: "Kalos" },
    { id: 664, name: "Scatterbug", type1: "Bug", type2: null, region: "Kalos" },
    { id: 659, name: "Bunnelby", type1: "Normal", type2: null, region: "Kalos" },
    { id: 674, name: "Pancham", type1: "Fighting", type2: null, region: "Kalos" },
    { id: 656, name: "Froakie", type1: "Water", type2: null, region: "Kalos" },
    { id: 783, name: "Pikipek", type1: "Normal", type2: "Flying", region: "Alola" },
    { id: 734, name: "Yungoos", type1: "Normal", type2: null, region: "Alola" },
    { id: 736, name: "Grubbin", type1: "Bug", type2: null, region: "Alola" },
    { id: 742, name: "Cutiefly", type1: "Bug", type2: "Fairy", region: "Alola" },
    { id: 722, name: "Rowlet", type1: "Grass", type2: "Flying", region: "Alola" },
  ],
  UNCOMMON: [
    { id: 179, name: "Mareep", type1: "Electric", type2: null, region: "Johto" },
    { id: 183, name: "Marill", type1: "Water", type2: "Fairy", region: "Johto" },
    { id: 204, name: "Pineco", type1: "Bug", type2: null, region: "Johto" },
    { id: 190, name: "Aipom", type1: "Normal", type2: null, region: "Johto" },
    { id: 198, name: "Murkrow", type1: "Dark", type2: "Flying", region: "Johto" },
    { id: 169, name: "Crobat", type1: "Poison", type2: "Flying", region: "Johto" },
    { id: 194, name: "Wooper", type1: "Water", type2: "Ground", region: "Johto" },
    { id: 177, name: "Natu", type1: "Psychic", type2: "Flying", region: "Johto" },
    { id: 667, name: "Litleo", type1: "Fire", type2: "Normal", region: "Kalos" },
    { id: 677, name: "Espurr", type1: "Psychic", type2: null, region: "Kalos" },
    { id: 714, name: "Noibat", type1: "Flying", type2: "Dragon", region: "Kalos" },
    { id: 679, name: "Honedge", type1: "Steel", type2: "Ghost", region: "Kalos" },
    { id: 704, name: "Goomy", type1: "Dragon", type2: null, region: "Kalos" },
    { id: 698, name: "Amaura", type1: "Rock", type2: "Ice", region: "Kalos" },
    { id: 744, name: "Rockruff", type1: "Rock", type2: null, region: "Alola" },
    { id: 757, name: "Salandit", type1: "Poison", type2: "Fire", region: "Alola" },
    { id: 747, name: "Mareanie", type1: "Poison", type2: "Water", region: "Alola" },
    { id: 778, name: "Mimikyu", type1: "Ghost", type2: "Fairy", region: "Alola" },
    { id: 770, name: "Palossand", type1: "Ghost", type2: "Ground", region: "Alola" },
  ],
  RARE: [
    { id: 248, name: "Tyranitar", type1: "Rock", type2: "Dark", region: "Johto" },
    { id: 245, name: "Suicune", type1: "Water", type2: null, region: "Johto" },
    { id: 718, name: "Zygarde", type1: "Dragon", type2: "Ground", region: "Kalos" },
    { id: 784, name: "Kommo-o", type1: "Dragon", type2: "Fighting", region: "Alola" },
    { id: 785, name: "Tapu Koko", type1: "Electric", type2: "Fairy", region: "Alola" },
  ],
};

export default POKEMON_POOL;

/**
 * Try to fetch a remote pokemon pool JSON. If `url` is not provided or fetch fails,
 * the function resolves with the local `POKEMON_POOL` fallback.
 * Expected remote shape: { COMMON: Pokemon[], UNCOMMON: Pokemon[], RARE: Pokemon[] }
 */
export async function fetchPokemonPool(url?: string): Promise<Record<Tier, Pokemon[]>> {
  if (!url) return POKEMON_POOL;

  // If the URL looks like a GitHub repo (e.g. https://github.com/owner/repo.git or without .git)
  const ghMatch = url.match(/github\.com\/(.+?)\/(.+?)(?:\.git)?(?:$|\/)/i);
  if (ghMatch) {
    const owner = ghMatch[1];
    const repo = ghMatch[2];
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (!res.ok) return POKEMON_POOL;
      const json = await res.json();
      if (!json || !Array.isArray(json.tree)) return POKEMON_POOL;
      const paths: string[] = json.tree.map((item: any) => item.path as string).filter(Boolean);
      const animatedPrefix = "sprites/pokemon/versions/generation-v/black-white/animated/";
      const idSet = new Set<number>();
      for (const p of paths) {
        if (!p.startsWith(animatedPrefix)) continue;
        const filename = p.substring(animatedPrefix.length);
        // skip back/ subfolder
        if (filename.startsWith("back/")) continue;
        // filename might be like '351-rainy.gif' or '25.gif' or '201-a.gif'
        const m = filename.match(/^(\d+)/);
        if (m) idSet.add(Number(m[1]));
      }
      if (idSet.size === 0) return POKEMON_POOL;
      // Build a map of known pokemon metadata from the bundled pool
      const byId = new Map<number, Pokemon>();
      const addToMap = (arr: Pokemon[]) => arr.forEach((p) => byId.set(p.id, p));
      addToMap(POKEMON_POOL.COMMON);
      addToMap(POKEMON_POOL.UNCOMMON);
      addToMap(POKEMON_POOL.RARE);

      const COMMON: Pokemon[] = [];
      const UNCOMMON: Pokemon[] = [];
      const RARE: Pokemon[] = [];

      idSet.forEach((id) => {
        if (byId.has(id)) {
          // use existing metadata and preserve original tier
          const p = byId.get(id)!;
          if (POKEMON_POOL.RARE.find((x) => x.id === id)) RARE.push(p);
          else if (POKEMON_POOL.UNCOMMON.find((x) => x.id === id)) UNCOMMON.push(p);
          else COMMON.push(p);
        } else {
          // synthesize minimal metadata for ids only present as sprites
          const synth: Pokemon = { id, name: `Pokémon #${id}`, type1: "Unknown", type2: null, region: "Unknown" };
          if ((ORIGINAL_RARE_IDS as readonly number[]).includes(id)) RARE.push(synth);
          else COMMON.push(synth);
        }
      });

      return { COMMON, UNCOMMON, RARE };
    } catch {
      return POKEMON_POOL;
    }
  }

  // Otherwise attempt to fetch a JSON file from the provided URL
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return POKEMON_POOL;
    const json = await res.json();
    // Basic validation: must contain COMMON/UNCOMMON/RARE arrays
    if (json && json.COMMON && json.UNCOMMON && json.RARE) return json as Record<Tier, Pokemon[]>;
    return POKEMON_POOL;
  } catch {
    return POKEMON_POOL;
  }
}
