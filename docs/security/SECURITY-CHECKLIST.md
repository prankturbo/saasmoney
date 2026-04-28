# 🔒 Checklist de Sécurité - SaaS Money

## ✅ Pré-Publication (À FAIRE MAINTENANT)

### 1. Configuration Supabase
- [ ] **Dashboard Supabase** → Authentication → URL Configuration
  - Site URL: `https://votre-app.vercel.app`
  - Redirect URLs: `https://votre-app.vercel.app/**`

- [ ] **Vérifier RLS** sur toutes les tables
  ```sql
  -- Exécutez dans SQL Editor :
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = false;
  -- Résultat attendu : 0 lignes (toutes les tables ont RLS activé)
  ```

- [ ] **API Settings** → Vérifier que vous utilisez bien `ANON_KEY` (pas `SERVICE_ROLE_KEY`)

### 2. Variables d'environnement Vercel
- [ ] Ajouter dans Vercel Dashboard → Settings → Environment Variables :
  - `NEXT_PUBLIC_SUPABASE_URL` = votre URL Supabase
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = votre clé publique

### 3. Git & Code
- [ ] Vérifier que `.env.local` est dans `.gitignore`
  ```bash
  git ls-files | grep .env
  # Ne doit RIEN afficher
  ```

- [ ] Push du code sur GitHub
  ```bash
  git add .
  git commit -m "Production ready - SaaS Money v1.0"
  git push origin main
  ```

---

## ✅ Post-Publication (APRÈS déploiement)

### 4. Tests de sécurité
- [ ] **Test des rôles** :
  - [ ] Un user ne peut pas accéder à `/admin`
  - [ ] Un closer ne peut voir que ses élèves
  - [ ] Un coach ne peut gérer que ses créneaux
  - [ ] Un user ne peut réserver que s'il a des coins

- [ ] **Test des permissions** :
  - [ ] Un user sans forfait ne peut pas réserver
  - [ ] Un user ne peut pas voir les données d'autres users
  - [ ] Les codes d'invitation ne peuvent être utilisés qu'une fois

### 5. Monitoring
- [ ] Configurer Vercel Analytics (gratuit)
- [ ] Configurer Supabase Logs & Monitoring
- [ ] Tester les notifications d'erreur

---

## 🔴 CRITIQUES (Obligatoires)

### ✅ Actuellement BIEN configuré :
1. ✅ Row Level Security (RLS) activé sur toutes les tables
2. ✅ Authentification via Supabase Auth
3. ✅ Routes protégées côté client
4. ✅ Permissions vérifiées avant actions
5. ✅ `.env.local` non versionné
6. ✅ Utilisation de la clé ANON (publique) uniquement

---

## 🟠 RECOMMANDATIONS (Améliorer après v1)

### 1. Rate Limiting
- Limiter les tentatives de connexion (10/min par IP)
- Limiter la génération d'invitations (100/jour par closer)

### 2. Validation des inputs
```typescript
// Exemple à ajouter dans les formulaires
import { z } from 'zod';

const paymentSchema = z.object({
  amount: z.number().min(100).max(15000),
  studentId: z.string().uuid(),
});
```

### 3. Logs & Alertes
- Configurer Sentry ou LogRocket pour capturer les erreurs
- Alertes email sur erreurs critiques

### 4. Backup automatique
- Activer les backups quotidiens Supabase (Dashboard → Database → Backups)

### 5. HTTPS / SSL
- ✅ Automatique avec Vercel (rien à faire)

---

## 📊 Niveaux de sécurité

| Aspect | Status | Priorité |
|--------|--------|----------|
| RLS Supabase | ✅ OK | 🔴 Critique |
| Authentication | ✅ OK | 🔴 Critique |
| Routes protégées | ✅ OK | 🔴 Critique |
| Env variables | ✅ OK | 🔴 Critique |
| Rate limiting | ⚠️ À faire | 🟡 Moyen |
| Input validation | ⚠️ À faire | 🟡 Moyen |
| Monitoring | ⚠️ À faire | 🟠 Important |
| Backups | ⚠️ À faire | 🟠 Important |

---

## 🚀 Verdict

### ✅ **OUI, vous pouvez publier !**

Votre application a tous les **éléments de sécurité critiques** en place :
- ✅ RLS activé
- ✅ Authentication Supabase
- ✅ Routes protégées
- ✅ Permissions vérifiées
- ✅ Secrets non exposés

### 📋 Avant de cliquer sur "Deploy" :
1. Configurez les URLs Supabase (Site URL + Redirect URLs)
2. Ajoutez les variables d'environnement dans Vercel
3. Testez avec un compte de chaque rôle (user, closer, coach, admin)

### 🎯 Après le déploiement :
- Activez les backups Supabase (recommandé)
- Configurez le monitoring (Vercel Analytics)
- Améliorez progressivement (rate limiting, validation)

---

**L'application est sécurisée pour un usage en production interne.** 🎉

Pour un usage public à grande échelle, ajoutez les recommandations 🟠 (rate limiting, monitoring avancé).
