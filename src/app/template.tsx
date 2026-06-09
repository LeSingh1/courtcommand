// Re-mounts on every navigation, so the CSS entrance replays on each route
// change — a smooth, reliable page transition that always ends fully visible.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
