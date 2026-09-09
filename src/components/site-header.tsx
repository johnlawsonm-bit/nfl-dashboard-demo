export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 sm:px-6">
        <h1 className="team-name text-2xl sm:text-3xl">Gridiron Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A fictional, dummy-data sports dashboard for demo purposes only. All
          teams, players, coaches, stats, and news are entirely fabricated and
          not affiliated with or endorsed by the NFL or any real team.
        </p>
      </div>
    </header>
  );
}
