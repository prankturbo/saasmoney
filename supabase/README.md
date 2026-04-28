# 🚀 Configuration Supabase - SaaS Money

## 📋 Étapes de configuration

### 1. Accéder au Dashboard Supabase
Ouvre [https://supabase.com/dashboard](https://supabase.com/dashboard) et connecte-toi au projet **kjkxdupqhesobjgoxkix**.

---

### 2. Créer les tables (SQL Editor)

1. Va dans **SQL Editor** dans le menu de gauche
2. Clique sur **New Query**
3. Copie-colle le contenu de `schema.sql`
4. Clique sur **Run** pour exécuter

⚠️ **Important** : Exécute le script en une seule fois pour créer toutes les tables et policies.

---

### 3. Créer les comptes utilisateurs (Authentication)

1. Va dans **Authentication** > **Users**
2. Clique sur **Add user** > **Create new user** pour chaque compte :

#### Closers
| Email | Mot de passe | Rôle |
|-------|--------------|------|
| clement@saasmoney.fr | [mot de passe] | closer |
| elias@saasmoney.fr | [mot de passe] | closer |
| leni@saasmoney.fr | [mot de passe] | closer |
| tino@saasmoney.fr | [mot de passe] | closer |

#### Coachs
| Email | Mot de passe | Rôle |
|-------|--------------|------|
| martin@saasmoney.fr | [mot de passe] | coach |
| augustin@saasmoney.fr | [mot de passe] | coach |

#### Admins
| Email | Mot de passe | Rôle |
|-------|--------------|------|
| sacha@saasmoney.fr | [mot de passe] | admin |
| quentin@saasmoney.fr | [mot de passe] | admin |

---

### 4. Mettre à jour les rôles

1. Va dans **SQL Editor**
2. Copie-colle le contenu de `seed-users.sql`
3. Clique sur **Run**

Cela mettra à jour les rôles (`closer`, `coach`, `admin`) pour chaque utilisateur créé.

---

### 5. Vérifier la configuration

Exécute ces requêtes pour vérifier :

```sql
-- Vérifier les profils
SELECT email, name, role FROM public.profiles ORDER BY role, name;

-- Vérifier les types de Hot-Seat
SELECT name, duration, is_active FROM public.hotset_types;

-- Vérifier les paramètres
SELECT * FROM public.app_settings;
```

---

## 📁 Structure des fichiers

```
supabase/
├── schema.sql          # Toutes les tables, fonctions et policies
├── seed-users.sql      # Script pour configurer les rôles utilisateurs
└── README.md           # Ce fichier
```

---

## 🔐 Variables d'environnement

Le fichier `.env.local` doit contenir :

```env
NEXT_PUBLIC_SUPABASE_URL=https://kjkxdupqhesobjgoxkix.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📊 Tables créées

| Table | Description |
|-------|-------------|
| `profiles` | Profils utilisateurs (lié à auth.users) |
| `invitation_codes` | Codes d'invitation des closers |
| `students` | Enregistrements des élèves |
| `student_payments` | Historique des paiements |
| `one_of_one_slots` | Créneaux One of One des coachs |
| `one_of_one_bookings` | Réservations One of One |
| `hotset_types` | Types de Hot-Seat |
| `hotset_slots` | Créneaux Hot-Seat des coachs |
| `hotset_bookings` | Réservations Hot-Seat |
| `conversations` | Conversations IA |
| `messages` | Messages dans les conversations |
| `app_settings` | Paramètres globaux |

---

## 🔧 Fonctions RPC

| Fonction | Description |
|----------|-------------|
| `debit_coins(user_uuid, amount)` | Débite des coins d'un utilisateur |
| `credit_coins(user_uuid, amount)` | Crédite des coins à un utilisateur |
| `unlock_student_coins(student_id, amount, note)` | Débloque des coins pour un élève |

---

## 🛡️ Row Level Security (RLS)

Toutes les tables ont RLS activé avec des policies appropriées :

- **Users** : Peuvent voir/modifier leur propre profil
- **Closers** : Peuvent gérer leurs invitations et élèves
- **Coachs** : Peuvent gérer leurs créneaux
- **Admins** : Accès total

---

## 🚀 Lancer l'application

```bash
bun run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

---

## ❓ Problèmes courants

### "Permission denied"
→ Vérifie que les RLS policies sont bien créées (exécute `schema.sql`)

### "User not found after registration"
→ Le trigger `on_auth_user_created` doit être actif pour créer automatiquement le profil

### "No slots available"
→ Les coachs doivent créer des créneaux depuis leur interface (`/coach`)
