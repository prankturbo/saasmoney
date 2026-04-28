"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, getRedirectPathForRole } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  // Rediriger si déjà connecté selon le rôle
  useEffect(() => {
    if (user) {
      const redirectPath = getRedirectPathForRole(user.role);
      router.replace(redirectPath);
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else if (result.user) {
        // Rediriger selon le rôle
        const redirectPath = getRedirectPathForRole(result.user.role);
        router.replace(redirectPath);
        setLoading(false);
      }
    } catch {
      setError("Une erreur est survenue");
      setLoading(false);
    }
  };

  return (
    <>
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-primary shadow-glow mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">SaaS Money</h1>
        <p className="text-gray-500 mt-2">Bienvenue ! Connectez-vous pour continuer.</p>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Email"
            type="email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
            required
          />

          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-5 h-5" />}
            required
          />

          {error && (
            <div className="p-3 rounded-2xl bg-red-50 text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <Button type="submit" variant="gradient" className="w-full" loading={loading}>
            Se connecter
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-magenta hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
      </Card>
    </>
  );
}
