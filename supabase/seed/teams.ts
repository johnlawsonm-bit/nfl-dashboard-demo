// Team roster of real NFL cities/conferences/divisions, generic fictional team names.
// No real team nicknames, mascots, or logos — see project memory for rationale.

export type TeamSeed = {
  city: string;
  name: string;
  conference: "AFC" | "NFC";
  division: "East" | "West" | "North" | "South";
  stadium_name: string;
  founded_year: number;
  primary_color: string;
  secondary_color: string;
};

const withDefaults = (
  city: string,
  conference: TeamSeed["conference"],
  division: TeamSeed["division"],
  opts: Partial<Pick<TeamSeed, "stadium_name" | "founded_year" | "primary_color" | "secondary_color">> = {}
): TeamSeed => ({
  city,
  name: `${city} Football Team`,
  conference,
  division,
  stadium_name: opts.stadium_name ?? `${city} Stadium`,
  founded_year: opts.founded_year ?? 1960 + Math.floor(Math.random() * 40),
  primary_color: opts.primary_color ?? "#0A1A3C",
  secondary_color: opts.secondary_color ?? "#C0C0C0",
});

export const teams: TeamSeed[] = [
  // AFC East
  withDefaults("Buffalo", "AFC", "East"),
  withDefaults("Miami", "AFC", "East"),
  withDefaults("New England", "AFC", "East"),
  { ...withDefaults("New York", "AFC", "East"), name: "New York Football Team 1" },

  // AFC North
  withDefaults("Baltimore", "AFC", "North"),
  withDefaults("Cincinnati", "AFC", "North"),
  withDefaults("Cleveland", "AFC", "North"),
  withDefaults("Pittsburgh", "AFC", "North"),

  // AFC South
  withDefaults("Houston", "AFC", "South"),
  withDefaults("Indianapolis", "AFC", "South"),
  withDefaults("Jacksonville", "AFC", "South"),
  withDefaults("Tennessee", "AFC", "South"),

  // AFC West
  withDefaults("Denver", "AFC", "West"),
  withDefaults("Kansas City", "AFC", "West"),
  withDefaults("Las Vegas", "AFC", "West"),
  { ...withDefaults("Los Angeles", "AFC", "West"), name: "Los Angeles Football Team 1" },

  // NFC East
  withDefaults("Dallas", "NFC", "East"),
  { ...withDefaults("New York", "NFC", "East"), name: "New York Football Team 2" },
  withDefaults("Philadelphia", "NFC", "East"),
  withDefaults("Washington", "NFC", "East"),

  // NFC North
  withDefaults("Chicago", "NFC", "North"),
  withDefaults("Detroit", "NFC", "North"),
  withDefaults("Green Bay", "NFC", "North"),
  withDefaults("Minnesota", "NFC", "North"),

  // NFC South
  withDefaults("Atlanta", "NFC", "South"),
  withDefaults("Carolina", "NFC", "South"),
  withDefaults("New Orleans", "NFC", "South"),
  withDefaults("Tampa Bay", "NFC", "South"),

  // NFC West
  withDefaults("Arizona", "NFC", "West"),
  { ...withDefaults("Los Angeles", "NFC", "West"), name: "Los Angeles Football Team 2" },
  withDefaults("San Francisco", "NFC", "West"),
  withDefaults("Seattle", "NFC", "West"),
];
