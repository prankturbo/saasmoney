"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  LogOut,
  Coins,
  Calendar,
  Shield,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    coach: "Coach",
    closer: "Closer",
    user: "Membre",
  };

  const role = user?.role || "user";
  const roleLabel = roleLabels[role] || role;

  const handleSave = async () => {
    setSaving(true);
    // Mock save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500">Gère ton compte et tes préférences.</p>
      </div>

      {/* Profile section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Profil</h2>

        <div className="flex items-center gap-6 mb-6">
          <Avatar src={user?.avatar} name={user?.name} size="lg" />
          <div>
            <Button variant="outline" size="sm">
              Changer la photo
            </Button>
            <p className="text-xs text-gray-400 mt-2">JPG, PNG. Max 2MB</p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Nom complet"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User className="w-5 h-5" />}
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
          />

          <Button variant="gradient" onClick={handleSave} loading={saving}>
            Enregistrer
          </Button>
        </div>
      </Card>

      {/* Account stats */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Ton compte
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-5 h-5 text-magenta" />
              <span className="text-sm text-gray-500">Coins</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {user?.coinsBalance || 0}
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-orange" />
              <span className="text-sm text-gray-500">Réservations</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">3</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-rose-light" />
              <span className="text-sm text-gray-500">Statut</span>
            </div>
            <Badge variant={role === "admin" ? "magenta" : "default"}>
              {roleLabel}
            </Badge>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Membre depuis</span>
            </div>
            <p className="text-sm font-medium text-gray-900">Janvier 2026</p>
          </div>
        </div>
      </Card>

      {/* Remboursement section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Remboursement
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Demander un remboursement</p>
            <p className="text-sm text-gray-500">
              Contacte l'administration pour toute demande de remboursement
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/app/remboursement")}
            className="flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Contacter
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="p-6 border-2 border-red-100">
        <h2 className="text-lg font-semibold text-red-600 mb-4">
          Zone de danger
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Déconnexion</p>
            <p className="text-sm text-gray-500">
              Tu pourras te reconnecter à tout moment
            </p>
          </div>
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </Card>
    </div>
  );
}

