import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { getTranslate } from "app/_utils";
import { format, parseISO } from "date-fns";
import { notFound } from "next/navigation";

type Side = { name: string; code: string; country: string };

type Match = {
  matchId: string;
  matchDay: number | null;
  stage: string;
  group: string | null;
  dateUtc: string;
  dateLocal: string;
  home: Side;
  away: Side;
  venue: { stadium: string; city: string; country: string };
};

export const dynamic = "force-static";

async function loadMatches(team: string): Promise<Match[] | null> {
  const file = path.join(process.cwd(), "public", "wc2026", `${team}-matches.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as Match[];
  } catch {
    return null;
  }
}

function groupByDay(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((acc, m) => {
    const day = format(parseISO(m.dateUtc), "yyyy-MM-dd");
    (acc[day] ??= []).push(m);
    return acc;
  }, {});
}

export default async function WC2026TeamPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const matches = await loadMatches(team);
  if (!matches) notFound();

  const t = await getTranslate();
  const teamDisplay = matches[0]
    ? matches[0].home.code === team.toUpperCase() || matches[0].home.name.toLowerCase() === team
      ? matches[0].home.name
      : matches[0].away.name
    : team;
  const byDay = groupByDay(matches);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("wc2026_title", { team: teamDisplay })}</h1>
      <p className="text-subtle mt-1">{t("wc2026_subtitle")}</p>

      {matches.length === 0 ? (
        <p className="mt-6">{t("wc2026_no_matches")}</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {Object.entries(byDay).map(([day, dayMatches]) => (
            <li key={day}>
              <h2 className="text-emphasis text-sm font-medium uppercase tracking-wide">
                {format(parseISO(day), "EEEE, MMMM d, yyyy")}
              </h2>
              <ul className="border-subtle mt-2 divide-y rounded-md border">
                {dayMatches.map((m) => (
                  <li key={m.matchId} className="flex flex-col gap-1 p-4 text-sm">
                    <div className="font-medium">
                      {m.home.name} ({m.home.code}) vs {m.away.name} ({m.away.code})
                    </div>
                    <div className="text-subtle">
                      {t("wc2026_stage")}: {m.stage}
                      {m.group ? ` · ${t("wc2026_group")}: ${m.group}` : ""}
                    </div>
                    <div className="text-subtle">
                      {t("wc2026_kickoff_local")}: {format(parseISO(m.dateLocal), "HH:mm")} ·{" "}
                      {t("wc2026_kickoff_utc")}: {format(parseISO(m.dateUtc), "HH:mm 'UTC'")}
                    </div>
                    <div className="text-subtle">
                      {t("wc2026_venue")}: {m.venue.stadium}, {m.venue.city} ({m.venue.country})
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
