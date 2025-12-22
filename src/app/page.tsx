export default function Home() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 28 }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#0f172a" }}>
        Provenance Platform
      </h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Intake → documents → provenance timeline → integrity score → client dossier.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
        <a href="/auth">Auth</a>
        <a href="/setup">Setup Org</a>
        <a href="/dashboard">Dashboard</a>
      </div>

      <div style={{ marginTop: 22, padding: 16, border: "1px solid #e5e7eb", borderRadius: 14 }}>
        <div style={{ fontWeight: 900 }}>First run checklist</div>
        <ol style={{ marginTop: 10, paddingLeft: 18, opacity: 0.9 }}>
          <li>Go to /auth and create an account</li>
          <li>Go to /setup to create your org + profile</li>
          <li>Go to /dashboard to create objects</li>
          <li>Open an object to add provenance events and upload docs</li>
        </ol>
      </div>
    </div>
  );
}
