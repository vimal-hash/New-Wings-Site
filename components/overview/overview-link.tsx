/** A real link also cancels outstanding scene downloads when someone leaves a stalled loader. */
export default function OverviewLink() {
  return (
    <a className="overview-link" href="?view=overview">
      Continue without 3D
    </a>
  );
}
