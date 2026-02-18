"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Prisijungti nepavyko");
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(data.role === "ADMIN" ? "/admin" : "/consultant");
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 460, margin: "60px auto" }}>
        <h1>Testų platforma</h1>
        <p className="small">Konsultantų ir administratoriaus prisijungimas</p>
        <form onSubmit={onSubmit} className="grid">
          <label>
            El. paštas
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Slaptažodis
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error ? <p style={{ color: "#8c2a2a" }}>{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Jungiama..." : "Prisijungti"}
          </button>
        </form>
      </div>
    </main>
  );
}
