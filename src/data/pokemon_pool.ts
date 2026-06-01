export type Region = "Johto" | "Kalos" | "Alola" | "Unknown";

export type Pokemon = {
  id: number;
  name: string;
  type1: string;
  type2: string | null;
  region: Region;
  sprite: string;
  cry: string;
};

export type Tier = "COMMON" | "UNCOMMON" | "RARE";

const SPRITE_BASE = "/sprites/pokemon/versions/generation-v/black-white/animated/";
const CRY_BASE = "/cries/";

const pokemon = (id: number, name: string, type1: string, type2: string | null, region: Region): Pokemon => ({
  id,
  name,
  type1,
  type2,
  region,
  sprite: `${SPRITE_BASE}${id}.gif`,
  cry: `${CRY_BASE}${id}.mp3`,
});

export const ORIGINAL_RARE_IDS = [18, 169, 658, 706, 784];

export const POKEMON_POOL: Record<Tier, Pokemon[]> = {
  COMMON: [
    pokemon(16, "Pidgey", "Normal", "Flying", "Johto"),
    pokemon(19, "Rattata", "Normal", null, "Johto"),
    pokemon(161, "Sentret", "Normal", null, "Johto"),
    pokemon(163, "Hoothoot", "Normal", "Flying", "Johto"),
    pokemon(41, "Zubat", "Poison", "Flying", "Johto"),
    pokemon(187, "Hoppip", "Grass", "Flying", "Johto"),
    pokemon(206, "Dunsparce", "Normal", null, "Johto"),
    pokemon(213, "Shuckle", "Bug", "Rock", "Johto"),
    pokemon(661, "Fletchling", "Normal", "Flying", "Kalos"),
    pokemon(664, "Scatterbug", "Bug", null, "Kalos"),
    pokemon(659, "Bunnelby", "Normal", null, "Kalos"),
    pokemon(674, "Pancham", "Fighting", null, "Kalos"),
    pokemon(656, "Froakie", "Water", null, "Kalos"),
    pokemon(734, "Yungoos", "Normal", null, "Alola"),
    pokemon(736, "Grubbin", "Bug", null, "Alola"),
    pokemon(742, "Cutiefly", "Bug", "Fairy", "Alola"),
    pokemon(722, "Rowlet", "Grass", "Flying", "Alola"),
    pokemon(179, "Mareep", "Electric", null, "Johto"),
    pokemon(204, "Pineco", "Bug", null, "Johto"),
    pokemon(190, "Aipom", "Normal", null, "Johto"),
    pokemon(198, "Murkrow", "Dark", "Flying", "Johto"),
    pokemon(194, "Wooper", "Water", "Ground", "Johto"),
    pokemon(177, "Natu", "Psychic", "Flying", "Johto"),
    pokemon(667, "Litleo", "Fire", "Normal", "Kalos"),
    pokemon(677, "Espurr", "Psychic", null, "Kalos"),
    pokemon(714, "Noibat", "Flying", "Dragon", "Kalos"),
    pokemon(679, "Honedge", "Steel", "Ghost", "Kalos"),
    pokemon(704, "Goomy", "Dragon", null, "Kalos"),
    pokemon(698, "Amaura", "Rock", "Ice", "Kalos"),
    pokemon(744, "Rockruff", "Rock", null, "Alola"),
    pokemon(757, "Salandit", "Poison", "Fire", "Alola"),
    pokemon(747, "Mareanie", "Poison", "Water", "Alola"),
    pokemon(778, "Mimikyu", "Ghost", "Fairy", "Alola"),
  ],
  UNCOMMON: [
    pokemon(17, "Pidgeotto", "Normal", "Flying", "Johto"),
    pokemon(20, "Raticate", "Normal", null, "Johto"),
    pokemon(42, "Golbat", "Poison", "Flying", "Johto"),
    pokemon(162, "Furret", "Normal", null, "Johto"),
    pokemon(164, "Noctowl", "Normal", "Flying", "Johto"),
    pokemon(178, "Xatu", "Psychic", "Flying", "Johto"),
    pokemon(180, "Flaaffy", "Electric", null, "Johto"),
    pokemon(183, "Marill", "Water", "Fairy", "Johto"),
    pokemon(188, "Skiploom", "Grass", "Flying", "Johto"),
    pokemon(195, "Quagsire", "Water", "Ground", "Johto"),
    pokemon(205, "Forretress", "Bug", "Steel", "Johto"),
    pokemon(424, "Ambipom", "Normal", null, "Johto"),
    pokemon(430, "Honchkrow", "Dark", "Flying", "Kalos"),
    pokemon(657, "Frogadier", "Water", null, "Kalos"),
    pokemon(660, "Diggersby", "Normal", "Ground", "Kalos"),
    pokemon(662, "Fletchinder", "Fire", "Flying", "Kalos"),
    pokemon(665, "Spewpa", "Bug", null, "Kalos"),
    pokemon(668, "Pyroar", "Fire", "Normal", "Kalos"),
    pokemon(675, "Pangoro", "Fighting", "Dark", "Kalos"),
    pokemon(678, "Meowstic", "Psychic", null, "Kalos"),
    pokemon(680, "Doublade", "Steel", "Ghost", "Kalos"),
    pokemon(699, "Aurorus", "Rock", "Ice", "Kalos"),
    pokemon(705, "Sliggoo", "Dragon", null, "Kalos"),
    pokemon(715, "Noivern", "Flying", "Dragon", "Kalos"),
    pokemon(723, "Dartrix", "Grass", "Flying", "Alola"),
    pokemon(735, "Gumshoos", "Normal", null, "Alola"),
    pokemon(737, "Charjabug", "Bug", "Electric", "Alola"),
    pokemon(743, "Ribombee", "Bug", "Fairy", "Alola"),
    pokemon(745, "Lycanroc", "Rock", null, "Alola"),
    pokemon(748, "Toxapex", "Poison", "Water", "Alola"),
    pokemon(758, "Salazzle", "Poison", "Fire", "Alola"),
    pokemon(770, "Palossand", "Ghost", "Ground", "Alola"),
    pokemon(783, "Pikipek", "Normal", "Flying", "Alola"),
  ],
  RARE: [
    pokemon(18, "Pidgeot", "Normal", "Flying", "Johto"),
    pokemon(169, "Crobat", "Poison", "Flying", "Johto"),
    pokemon(658, "Greninja", "Water", "Dark", "Kalos"),
    pokemon(706, "Goodra", "Dragon", null, "Kalos"),
    pokemon(784, "Kommo-o", "Dragon", "Fighting", "Alola"),
  ],
};

export default POKEMON_POOL;
